import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

async function applyApartmentChanges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  advertisementId: string,
  apartments: { apartmentId: string; totalHouseholds: number }[]
): Promise<void> {
  await supabase
    .from('advertisement_apartments_v2')
    .delete()
    .eq('advertisementId', advertisementId);

  await supabase
    .from('advertisement_apartments_v2')
    .insert(
      apartments.map((a) => ({
        advertisementId,
        apartmentId: a.apartmentId,
        totalHouseholds: a.totalHouseholds,
      }))
    );
}

// running 광고 수정 심사 승인
// pendingChanges를 실제 컬럼에 적용하고 modificationStatus를 초기화
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const adminMonthlyAmount: number | undefined =
      typeof body.monthlyAmount === 'number' && body.monthlyAmount > 0
        ? body.monthlyAmount
        : undefined;
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r => ['SUPER_ADMIN', 'MANAGER'].includes(r.role));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // 광고 조회 (modificationStatus, pendingChanges, 할인율 포함)
    const { data: ad, error: fetchError } = await supabase
      .from('advertisements_v2')
      .select('adStatus, modificationStatus, pendingChanges, partnerId, title, "approvedDiscountRate", "approvedMonthlyAmount"')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json({ error: 'Advertisement not found' }, { status: 404 });
    }

    if (ad.modificationStatus !== 'pending') {
      return NextResponse.json({ error: 'No pending modification to approve' }, { status: 400 });
    }

    if (!ad.pendingChanges) {
      return NextResponse.json({ error: 'pendingChanges is empty' }, { status: 400 });
    }

    const changes = ad.pendingChanges as Record<string, unknown>;

    // subCategoryIds, apartments는 junction table로 처리 (advertisements_v2 컬럼에 없음)
    const { subCategoryIds, apartments: pendingApartments, ...adChanges } = changes;

    // 아파트 변경 포함 여부 확인 (Design Ref: §6.1)
    const hasPendingApartments = Array.isArray(pendingApartments) && pendingApartments.length > 0;
    const now = new Date().toISOString();

    // 승인 결과 상태 (알림 문구 분기용): 아파트 변경으로 차액결제/변경예정이 걸린 경우만 설정
    let notificationStatus: 'pending_payment' | 'pending_next_cycle' | null = null;

    if (hasPendingApartments) {
      // 아파트 변경 포함 — 4가지 케이스 분기
      const aptList = pendingApartments as { apartmentId: string; totalHouseholds: number }[];

      // 현재 아파트 조회 (ID + 세대수)
      const { data: currentApts } = await supabase
        .from('advertisement_apartments_v2')
        .select('"apartmentId", "totalHouseholds"')
        .eq('advertisementId', id);

      // 단가 조회
      const { data: pricing } = await supabase
        .from('ad_pricing_v2')
        .select('"pricePerHousehold"')
        .order('effectiveFrom', { ascending: false })
        .limit(1)
        .maybeSingle();

      const pricePerHousehold: number = (pricing as any)?.pricePerHousehold ?? 70;

      const calcFee = (apts: { totalHouseholds: number }[]): number => {
        const adRow = ad as any;
        const discountRate: number = adRow?.approvedDiscountRate ?? 0;
        const total = apts.reduce((s, a) => s + a.totalHouseholds, 0);
        const original = Math.round((total * pricePerHousehold) / 10) * 10;
        return Math.round((original * (100 - discountRate)) / 100 / 10) * 10;
      };

      const currentFee = (ad as any).approvedMonthlyAmount ??
        calcFee((currentApts ?? []) as { totalHouseholds: number }[]);
      const newFee = calcFee(aptList);
      // 관리자 직접 입력 금액 우선, 없으면 자동계산
      const actualNewFee = adminMonthlyAmount ?? newFee;

      // 실제 아파트 변경 여부 확인 (동일 아파트면 일반 텍스트 수정으로 처리)
      const currentAptIds = new Set(
        (currentApts ?? []).map((a: any) => a.apartmentId as string),
      );
      const newAptIds = new Set(aptList.map((a) => a.apartmentId));
      const apartmentsActuallyChanged =
        currentAptIds.size !== newAptIds.size ||
        [...newAptIds].some((aptId) => !currentAptIds.has(aptId));

      if (!apartmentsActuallyChanged) {
        // 동일 아파트로 수정 신청이 들어온 경우 → 아파트 변경 없는 일반 수정으로 처리
        const { error: updateError } = await supabase
          .from('advertisements_v2')
          .update({
            ...adChanges,
            ...(adminMonthlyAmount !== undefined ? { approvedMonthlyAmount: adminMonthlyAmount } : {}),
            apartmentChangeStatus: null,
            modificationStatus: null,
            modificationRejectedReason: null,
            pendingChanges: null,
            updatedAt: now,
          })
          .eq('id', id);

        if (updateError) {
          console.error('Failed to approve modification (same apartments):', updateError);
          return NextResponse.json({ error: 'Failed to approve modification' }, { status: 500 });
        }

        if (adminMonthlyAmount !== undefined) {
          const { data: subSameApt } = await supabase
            .from('ad_subscriptions_v2')
            .select('id')
            .eq('advertisementId', id)
            .in('subscriptionStatus', ['active', 'grace_period', 'cancel_pending'])
            .order('createdAt', { ascending: false })
            .limit(1)
            .maybeSingle();
          if ((subSameApt as any)?.id) {
            await adminSupabase.from('ad_subscriptions_v2').update({
              monthlyAmount: adminMonthlyAmount,
            }).eq('id', (subSameApt as any).id);
          }
        }

        // 서브카테고리 업데이트 후 바로 리턴
        if (Array.isArray(subCategoryIds)) {
          await supabase
            .from('advertisement_sub_categories_v2')
            .delete()
            .eq('advertisementId', id);

          if (subCategoryIds.length > 0) {
            await supabase
              .from('advertisement_sub_categories_v2')
              .insert(
                subCategoryIds.map((subId: string) => ({
                  advertisementId: id,
                  subCategoryId: subId,
                })),
              );
          }
        }

        return NextResponse.json({ success: true });
      }

      // 무료기간 여부 확인
      const { data: subscription } = await supabase
        .from('ad_subscriptions_v2')
        .select('id, "freeEndDate"')
        .eq('advertisementId', id)
        .in('subscriptionStatus', ['active', 'grace_period', 'cancel_pending'])
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      const freeEndDate: string | null = (subscription as any)?.freeEndDate ?? null;
      const isInFreeTrial = freeEndDate !== null && new Date(freeEndDate) > new Date();

      if (newFee > currentFee) {
        if (isInFreeTrial) {
          // 케이스 1: 금액 증가 + 무료기간 → 즉시 적용, 결제 없음
          await applyApartmentChanges(supabase, id, aptList);
          await supabase.from('advertisements_v2').update({
            ...adChanges,
            apartmentChangeStatus: null,
            modificationStatus: null,
            modificationRejectedReason: null,
            pendingChanges: null,  // adChanges가 이미 컬럼에 직접 적용됨
            approvedMonthlyAmount: actualNewFee,
            updatedAt: now,
          }).eq('id', id);

          if ((subscription as any)?.id) {
            await adminSupabase.from('ad_subscriptions_v2').update({
              monthlyAmount: actualNewFee,
            }).eq('id', (subscription as any).id);
          }
        } else {
          // 케이스 2: 금액 증가 + 결제 이력 → 아파트 노출만 차액결제까지 보류, 나머지는 승인 즉시 반영
          await supabase.from('advertisements_v2').update({
            ...adChanges,                                       // 제목/내용/이미지/링크 즉시 반영
            apartmentChangeStatus: 'pending_payment',
            modificationStatus: null,
            modificationRejectedReason: null,
            pendingChanges: { apartments: pendingApartments },  // 아파트만 차액결제 시 적용하도록 보존
            updatedAt: now,
          }).eq('id', id);
          notificationStatus = 'pending_payment';

          // 차액결제 대기(pending_payment) 중에는 monthlyAmount를 미리 올리지 않는다.
          // 정기결제는 기존 요금(approvedMonthlyAmount)으로 청구되어야 하며,
          // monthlyAmount는 차액결제 성공 시 inicis-charge-apartment-difference EF가 세팅한다.
        }
      } else {
        if (isInFreeTrial || newFee === currentFee) {
          // 케이스 3: 금액 감소/동일 + 무료기간 or 금액 동일 → 즉시 적용, 결제 없음
          await applyApartmentChanges(supabase, id, aptList);
          await supabase.from('advertisements_v2').update({
            ...adChanges,
            apartmentChangeStatus: null,
            modificationStatus: null,
            modificationRejectedReason: null,
            pendingChanges: null,  // adChanges가 이미 컬럼에 직접 적용됨
            approvedMonthlyAmount: actualNewFee,
            updatedAt: now,
          }).eq('id', id);

          if ((subscription as any)?.id) {
            await adminSupabase.from('ad_subscriptions_v2').update({
              monthlyAmount: actualNewFee,
            }).eq('id', (subscription as any).id);
          }
        } else {
          // 케이스 4: 금액 감소 + 결제 이력 → 아파트 노출만 다음 정기결제일에 적용, 나머지는 승인 즉시 반영
          await supabase.from('advertisements_v2').update({
            ...adChanges,                                       // 제목/내용/이미지/링크 즉시 반영
            apartmentChangeStatus: 'pending_next_cycle',
            modificationStatus: null,
            modificationRejectedReason: null,
            pendingChanges: { apartments: pendingApartments },  // 아파트만 다음 정기일에 적용하도록 보존
            updatedAt: now,
          }).eq('id', id);
          notificationStatus = 'pending_next_cycle';

          if ((subscription as any)?.id) {
            await adminSupabase.from('ad_subscriptions_v2').update({
              monthlyAmount: actualNewFee,
            }).eq('id', (subscription as any).id);
          }
        }
      }
    } else {
      // 아파트 변경 없는 일반 텍스트 수정
      const { error: updateError } = await supabase
        .from('advertisements_v2')
        .update({
          ...adChanges,
          ...(adminMonthlyAmount !== undefined ? { approvedMonthlyAmount: adminMonthlyAmount } : {}),
          modificationStatus: null,
          modificationRejectedReason: null,
          pendingChanges: null,
          updatedAt: now,
        })
        .eq('id', id);

      if (updateError) {
        console.error('Failed to approve modification:', updateError);
        return NextResponse.json({ error: 'Failed to approve modification' }, { status: 500 });
      }

      if (adminMonthlyAmount !== undefined) {
        const { data: subText } = await supabase
          .from('ad_subscriptions_v2')
          .select('id')
          .eq('advertisementId', id)
          .in('subscriptionStatus', ['active', 'grace_period', 'cancel_pending'])
          .order('createdAt', { ascending: false })
          .limit(1)
          .maybeSingle();
        if ((subText as any)?.id) {
          await adminSupabase.from('ad_subscriptions_v2').update({
            monthlyAmount: adminMonthlyAmount,
          }).eq('id', (subText as any).id);
        }
      }
    }

    // 서브카테고리 junction table 업데이트 (아파트 변경 여부와 무관하게 승인 즉시 반영)
    if (Array.isArray(subCategoryIds)) {
      const { error: deleteError } = await supabase
        .from('advertisement_sub_categories_v2')
        .delete()
        .eq('advertisementId', id);

      if (deleteError) {
        console.error('Failed to delete sub categories:', deleteError);
        return NextResponse.json({ error: 'Failed to update sub categories' }, { status: 500 });
      }

      if (subCategoryIds.length > 0) {
        const rows = subCategoryIds.map((subId: string) => ({
          advertisementId: id,
          subCategoryId: subId,
        }));
        const { error: insertError } = await supabase
          .from('advertisement_sub_categories_v2')
          .insert(rows);

        if (insertError) {
          console.error('Failed to insert sub categories:', insertError);
          return NextResponse.json({ error: 'Failed to update sub categories' }, { status: 500 });
        }
      }
    }

    // 알림 문구: 아파트 변경으로 차액결제/변경예정이 걸린 경우 상태별로 분기 (그 외는 기존 문구 유지)
    const adTitle = (adChanges.title as string | undefined) ?? (ad as any).title ?? '광고';
    let notificationBody = '광고 수정 요청이 승인되었습니다.';
    if (notificationStatus === 'pending_payment') {
      notificationBody = `${adTitle} 수정이 승인되었습니다. 앱에서 차액결제가 필요합니다.`;
    } else if (notificationStatus === 'pending_next_cycle') {
      notificationBody = `${adTitle} 수정이 승인되었습니다. 다음 정기일에 변경 예정입니다.`;
    }

    // 수정 승인 FCM 알림 전송 (non-critical: 실패해도 승인 처리는 유지)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-partner-fcm-notification`;

      await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: ad.partnerId,
          title: '광고 수정 심사 결과',
          body: notificationBody,
          type: 'ad_approved',
          navigationData: {
            type: 'ad_detail',
            params: { advertisementId: id },
          },
        }),
      });
    } catch (notificationError) {
      console.error('수정 승인 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
