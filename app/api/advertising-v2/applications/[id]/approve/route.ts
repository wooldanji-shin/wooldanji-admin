import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { BIZ_CALL_DUPLICATE_MESSAGE, findBizCallDuplicate } from '@/lib/biz-call';
import {
  PRICE_LOOKUP_FAILED_MESSAGE,
  ZERO_HOUSEHOLDS_MESSAGE,
  calcMonthlyAmount,
  fetchPricePerHousehold,
} from '@/lib/ads/pricing';
import {
  canStartWithoutCard,
  insertCardlessSubscription,
  startedAdColumns,
} from '@/lib/ads/start-without-card';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('userId', currentUser.id);

    const isAdmin = roles?.some(r =>
      ['SUPER_ADMIN', 'MANAGER'].includes(r.role)
    );

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { freeMonths, discountRate, overrideEnabled, discountNote, categoryId, subCategoryIds, adminMemo, bizCallNumber, salesRepId, startImmediately: requestedStart } = body as {
      freeMonths: number;
      discountRate: number;
      overrideEnabled?: boolean;
      /** 카드 등록 없이 바로 개시 — 서버가 확정한 할인율이 100%일 때만 유효 */
      startImmediately?: boolean;
      discountNote?: string;
      categoryId?: string;
      subCategoryIds?: string[];
      adminMemo?: string;
      bizCallNumber?: string;
      salesRepId?: string | null;
    };

    const { data: ad, error: fetchError } = await supabase
      .from('advertisements_v2')
      .select('adStatus, partnerId, isFirstAdApplication')
      .eq('id', id)
      .single();

    if (fetchError || !ad) {
      return NextResponse.json(
        { error: 'Advertisement not found' },
        { status: 404 }
      );
    }

    if (ad.adStatus !== 'pending') {
      return NextResponse.json(
        { error: 'Advertisement is not pending' },
        { status: 400 }
      );
    }

    // Design Ref: §4.3 — 이중 방어: isFirstAdApplication(광고 레벨) + hasHadRunningAd(파트너 레벨)
    // isFirstAdApplication: 제출 시 Flutter가 설정, 파트너당 1개만 true → 관리자 UX 기준
    // hasHadRunningAd: running 전환 시 설정, 어뷰징 방어 최종 방어선
    const { data: partnerData } = await supabase
      .from('partner_users')
      .select('hasHadRunningAd')
      .eq('id', ad.partnerId)
      .single();

    // isFirstAdApplication이 null이면(DB 컬럼 추가 전) hasHadRunningAd로 fallback
    const isFirstAdApplication = (ad as any).isFirstAdApplication;
    const isFirstAd = (isFirstAdApplication !== null && isFirstAdApplication !== undefined)
      ? (isFirstAdApplication === true && !partnerData?.hasHadRunningAd)
      : !partnerData?.hasHadRunningAd;

    // overrideEnabled: 관리자가 파트너와 협의 후 비첫광고에 예외 적용하는 경우
    const canApplyBenefits = isFirstAd || overrideEnabled === true;

    // canApplyBenefits가 아니면 할인율·무료기간 모두 강제 0
    const effectiveDiscountRate = canApplyBenefits ? (discountRate ?? 0) : 0;
    const effectiveFreeMonths   = canApplyBenefits ? (freeMonths ?? 0) : 0;

    // 세대수·단가 조회가 실패하면 승인을 중단한다.
    // 실패를 무시하고 0세대·기본 단가로 계산하면 월 금액 0원이 저장되고,
    // 결제 EF가 이를 재계산하면서 과금 사고로 이어진 전례가 있다(2026-10-01).
    const { data: householdsData, error: householdsError } = await supabase
      .from('advertisement_apartments_v2')
      .select('totalHouseholds')
      .eq('advertisementId', id);

    if (householdsError) {
      console.error('Failed to fetch households for approval:', householdsError);
      return NextResponse.json(
        { error: '노출 아파트 세대수를 조회할 수 없습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    const totalHouseholds = (householdsData ?? []).reduce(
      (sum: number, row: { totalHouseholds: number }) => sum + (row.totalHouseholds ?? 0),
      0
    );

    if (totalHouseholds <= 0) {
      console.error(`Approval blocked: zero households (adId=${id}, rows=${householdsData?.length ?? 0})`);
      return NextResponse.json({ error: ZERO_HOUSEHOLDS_MESSAGE }, { status: 400 });
    }

    let pricePerHousehold: number;
    try {
      pricePerHousehold = await fetchPricePerHousehold(supabase);
    } catch {
      return NextResponse.json({ error: PRICE_LOOKUP_FAILED_MESSAGE }, { status: 500 });
    }

    const approvedMonthlyAmount = calcMonthlyAmount(
      totalHouseholds,
      pricePerHousehold,
      effectiveDiscountRate
    );

    // 받을 돈이 0원(100% 할인)일 때만 파트너 결제 없이 바로 개시할 수 있다 — 등록·수정 폼과 같은 규칙
    const startImmediately = canStartWithoutCard(requestedStart, effectiveDiscountRate);

    // 비즈콜(안심번호)은 파트너 단위 속성이라 partner_users에 저장.
    // 광고 상태 변경 전에 처리해야 실패 시 pending으로 남아 재시도할 수 있다.
    if (bizCallNumber !== undefined) {
      // 같은 번호를 두 파트너가 쓰면 앱에서 어느 광고로 걸려온 문의인지 구분할 수 없다
      const bizCallOwner = await findBizCallDuplicate(supabase, bizCallNumber, ad.partnerId);
      if (bizCallOwner) {
        return NextResponse.json(
          { error: `${BIZ_CALL_DUPLICATE_MESSAGE} (${bizCallOwner.businessName})` },
          { status: 409 }
        );
      }

      const { error: bizCallError } = await supabase
        .from('partner_users')
        .update({ bizCallNumber: bizCallNumber.trim() || null })
        .eq('id', ad.partnerId);

      if (bizCallError) {
        console.error('Failed to update bizCallNumber:', bizCallError);
        return NextResponse.json(
          { error: 'Failed to update biz call number' },
          { status: 500 }
        );
      }
    }

    const { error: updateError } = await supabase
      .from('advertisements_v2')
      .update({
        adStatus: 'approved',
        freeMonths: effectiveFreeMonths,
        approvedDiscountRate: effectiveDiscountRate,
        approvedMonthlyAmount,
        approvedAt: new Date().toISOString(),
        // 파트너에게 표시되는 안내 문구 — 입력됐을 때만 앱에 노출된다
        discountNote: discountNote?.trim() || null,
        adminMemo: adminMemo?.trim() || null,
        // 영업 담당자는 선택 항목 — 미지정이면 null로 비운다
        ...(salesRepId !== undefined ? { salesRepId: salesRepId || null } : {}),
        ...(categoryId ? { categoryId } : {}),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to approve advertisement:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve advertisement' },
        { status: 500 }
      );
    }

    // 서브카테고리 override: 제공된 경우 junction table 교체
    if (subCategoryIds !== undefined) {
      const { error: deleteError } = await supabase
        .from('advertisement_sub_categories_v2')
        .delete()
        .eq('advertisementId', id);

      if (deleteError) {
        console.error('Failed to delete sub categories:', deleteError);
        return NextResponse.json({ error: 'Failed to update sub categories' }, { status: 500 });
      }

      if (subCategoryIds.length > 0) {
        const { error: insertError } = await supabase
          .from('advertisement_sub_categories_v2')
          .insert(subCategoryIds.map((subCategoryId) => ({ advertisementId: id, subCategoryId })));

        if (insertError) {
          console.error('Failed to insert sub categories:', insertError);
          return NextResponse.json({ error: 'Failed to update sub categories' }, { status: 500 });
        }
      }
    }

    // 카드 없이 개시 — 구독을 먼저 만든다. 실패해도 광고는 승인·미결제 상태로 남아 파트너가 결제할 수 있다.
    if (startImmediately) {
      const admin = createAdminClient();
      const startedAt = new Date().toISOString();

      const subscriptionError = await insertCardlessSubscription(admin, {
        advertisementId: id,
        originalMonthlyAmount: calcMonthlyAmount(totalHouseholds, pricePerHousehold, 0),
        discountRate: effectiveDiscountRate,
        monthlyAmount: approvedMonthlyAmount,
        startedAt,
      });

      if (subscriptionError) {
        return NextResponse.json(
          { error: '승인은 됐지만 바로 개시하지 못했습니다. 수정 화면에서 다시 시도해주세요.' },
          { status: 500 }
        );
      }

      const { error: startError } = await admin
        .from('advertisements_v2')
        .update(startedAdColumns(startedAt))
        .eq('id', id);

      // running으로 못 넘겼는데 구독만 남으면 파트너가 결제 시 구독이 두 개가 된다
      if (startError) {
        console.error('Failed to start advertisement on approval:', startError);
        await admin.from('ad_subscriptions_v2').delete().eq('advertisementId', id);
        return NextResponse.json(
          { error: '승인은 됐지만 바로 개시하지 못했습니다. 수정 화면에서 다시 시도해주세요.' },
          { status: 500 }
        );
      }

      // 운영까지 간 광고가 생겼다는 표식 — 남기지 않으면 다음 광고에도 첫 광고 혜택이 또 붙는다
      await admin.from('partner_users').update({ hasHadRunningAd: true }).eq('id', ad.partnerId);
    }

    // 광고 승인 FCM 알림 전송 (non-critical: 실패해도 승인 처리는 유지)
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
          title: startImmediately ? '광고 시작 안내' : '광고 심사 결과',
          body: startImmediately
            ? '광고가 시작되었습니다. 앱에서 확인해보세요.'
            : effectiveDiscountRate > 0
              ? `신청하신 광고가 승인되었습니다. ${effectiveDiscountRate}% 할인이 적용되었습니다.`
              : '신청하신 광고가 승인되었습니다. 앱에서 결제 후 광고를 시작해보세요.',
          type: 'ad_approved',
          navigationData: {
            type: 'ad_detail',
            params: { advertisementId: id },
          },
        }),
      });
    } catch (notificationError) {
      console.error('광고 승인 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: 'Advertisement approved successfully',
      startImmediately,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
