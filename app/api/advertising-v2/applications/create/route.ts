import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  calcMonthlyAmount,
  computeIsFirstAdApplication,
  fetchApartmentHouseholds,
  fetchPricePerHousehold,
  resolveBenefits,
} from '@/lib/ads/pricing';
import { ctaButtonsError, ctaUrlOfType, type CtaButton } from '@/lib/cta-button';
import { MAX_AD_IMAGES } from '@/lib/ads/constants';
import { BIZ_CALL_DUPLICATE_MESSAGE, findBizCallDuplicate } from '@/lib/biz-call';

interface CreateBody {
  partnerId: string;
  categoryId: string;
  subCategoryIds?: string[];
  title: string;
  content?: string;
  imageUrls?: string[];
  naverMapUrl?: string;
  blogUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  kakaoOpenChatUrl?: string;
  ctaButtons?: CtaButton[];
  apartmentIds: string[];
  freeMonths?: number;
  discountRate?: number;
  overrideEnabled?: boolean;
  discountNote?: string;
  adminMemo?: string;
  bizCallNumber?: string;
  grantAnalytics?: boolean;
  salesRepId?: string | null;
}

function trimmedOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * 관리자가 파트너를 대신해 기본 광고를 등록한다.
 *
 * 파트너의 제출(pending)과 관리자 승인(approved)을 한 번에 처리해
 * 결제만 남은 상태(approved + unpaid)로 만든다.
 *
 * advertisements_v2의 INSERT 정책은 본인 광고만 허용하므로(partnerId = my_partner_id())
 * 관리자 세션으로는 다른 파트너의 광고를 만들 수 없다. 쓰기는 service_role로 처리한다.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    const body = await request.json() as CreateBody;
    const {
      partnerId,
      categoryId,
      subCategoryIds = [],
      title,
      apartmentIds = [],
      imageUrls = [],
      ctaButtons = [],
      overrideEnabled,
      grantAnalytics,
    } = body;

    if (!partnerId || !categoryId || !title?.trim()) {
      return NextResponse.json(
        { error: '파트너·카테고리·제목은 필수입니다.' },
        { status: 400 }
      );
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: '광고 이미지를 1장 이상 등록해주세요.' },
        { status: 400 }
      );
    }

    if (imageUrls.length > MAX_AD_IMAGES) {
      return NextResponse.json(
        { error: `광고 이미지는 최대 ${MAX_AD_IMAGES}장까지 등록할 수 있습니다.` },
        { status: 400 }
      );
    }

    const ctaError = ctaButtonsError(ctaButtons);
    if (ctaError) {
      return NextResponse.json({ error: ctaError }, { status: 400 });
    }

    // 아파트가 없으면 광고료가 0원이 되어 결제 흐름이 깨진다
    const uniqueApartmentIds = [...new Set(apartmentIds)];
    if (uniqueApartmentIds.length === 0) {
      return NextResponse.json(
        { error: '노출할 아파트를 1곳 이상 선택해주세요.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: partner } = await admin
      .from('partner_users')
      .select('id, analyticsEnabled')
      .eq('id', partnerId)
      .maybeSingle();

    if (!partner) {
      return NextResponse.json({ error: '파트너를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 같은 번호를 두 파트너가 쓰면 앱에서 어느 광고로 걸려온 문의인지 구분할 수 없다
    const bizCallOwner = await findBizCallDuplicate(admin, body.bizCallNumber, partnerId);
    if (bizCallOwner) {
      return NextResponse.json(
        { error: `${BIZ_CALL_DUPLICATE_MESSAGE} (${bizCallOwner.businessName})` },
        { status: 409 }
      );
    }

    // 세대수는 클라이언트 값을 쓰지 않고 서버가 다시 집계한다
    const households = await fetchApartmentHouseholds(admin, uniqueApartmentIds);
    const missing = uniqueApartmentIds.filter((id) => !households.has(id));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: '세대수 정보가 없는 아파트가 있습니다. 아파트 동 정보를 먼저 등록해주세요.' },
        { status: 400 }
      );
    }

    const totalHouseholds = [...households.values()].reduce((sum, n) => sum + n, 0);

    const isFirstAd = await computeIsFirstAdApplication(admin, partnerId);
    const { discountRate, freeMonths } = resolveBenefits({
      isFirstAd,
      overrideEnabled,
      discountRate: body.discountRate,
      freeMonths: body.freeMonths,
    });

    const pricePerHousehold = await fetchPricePerHousehold(admin);
    const approvedMonthlyAmount = calcMonthlyAmount(
      totalHouseholds,
      pricePerHousehold,
      discountRate
    );

    const now = new Date().toISOString();

    const { data: inserted, error: insertError } = await admin
      .from('advertisements_v2')
      .insert({
        partnerId,
        categoryId,
        title: title.trim(),
        content: trimmedOrNull(body.content),
        imageUrls,
        naverMapUrl: trimmedOrNull(body.naverMapUrl),
        blogUrl: trimmedOrNull(body.blogUrl),
        youtubeUrl: trimmedOrNull(body.youtubeUrl),
        instagramUrl: trimmedOrNull(body.instagramUrl),
        kakaoOpenChatUrl: trimmedOrNull(body.kakaoOpenChatUrl),
        // 배달앱 링크는 ctaButtons에서 파생시킨다 —
        // ctaButtons를 모르는 구버전 앱도 같은 버튼을 노출하도록 컬럼을 함께 채운다
        baeminUrl: ctaUrlOfType(ctaButtons, 'baemin'),
        coupangEatsUrl: ctaUrlOfType(ctaButtons, 'coupangEats'),
        ctaButtons: ctaButtons.length > 0 ? ctaButtons : null,
        adStatus: 'approved',
        paymentStatus: 'unpaid',
        isFirstAdApplication: isFirstAd,
        freeMonths,
        approvedDiscountRate: discountRate,
        approvedMonthlyAmount,
        // 목록이 submittedAt 기준으로 정렬되므로 대리 등록도 채워둔다
        submittedAt: now,
        approvedAt: now,
        updatedAt: now,
        discountNote: overrideEnabled === true ? trimmedOrNull(body.discountNote) : null,
        adminMemo: trimmedOrNull(body.adminMemo),
        salesRepId: body.salesRepId || null,
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('Failed to create advertisement:', insertError);
      return NextResponse.json({ error: 'Failed to create advertisement' }, { status: 500 });
    }

    const advertisementId = inserted.id as string;

    // 아파트·서브카테고리가 빠지면 금액 0원짜리 반쪽 광고가 남으므로 실패 시 광고째로 되돌린다
    const { error: apartmentError } = await admin
      .from('advertisement_apartments_v2')
      .insert(
        uniqueApartmentIds.map((apartmentId) => ({
          advertisementId,
          apartmentId,
          totalHouseholds: households.get(apartmentId) ?? 0,
        }))
      );

    if (apartmentError) {
      console.error('Failed to insert apartments:', apartmentError);
      await admin.from('advertisements_v2').delete().eq('id', advertisementId);
      return NextResponse.json({ error: 'Failed to save apartments' }, { status: 500 });
    }

    if (subCategoryIds.length > 0) {
      const { error: subCategoryError } = await admin
        .from('advertisement_sub_categories_v2')
        .insert(
          subCategoryIds.map((subCategoryId) => ({ advertisementId, subCategoryId }))
        );

      if (subCategoryError) {
        console.error('Failed to insert sub categories:', subCategoryError);
        await admin.from('advertisements_v2').delete().eq('id', advertisementId);
        return NextResponse.json({ error: 'Failed to save sub categories' }, { status: 500 });
      }
    }

    // 비즈콜(안심번호)·광고분석 권한은 파트너 단위 속성이라 partner_users에 저장
    const partnerUpdate: Record<string, unknown> = {};
    if (body.bizCallNumber !== undefined) {
      partnerUpdate.bizCallNumber = trimmedOrNull(body.bizCallNumber);
    }
    if (grantAnalytics && !(partner as { analyticsEnabled?: boolean }).analyticsEnabled) {
      partnerUpdate.analyticsEnabled = true;
    }
    if (Object.keys(partnerUpdate).length > 0) {
      const { error: partnerError } = await admin
        .from('partner_users')
        .update(partnerUpdate)
        .eq('id', partnerId);

      if (partnerError) {
        console.error('Failed to update partner:', partnerError);
      }
    }

    // 광고 등록 알림 (non-critical: 실패해도 등록은 유지)
    try {
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-partner-fcm-notification`;

      await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          partnerUserId: partnerId,
          title: '광고 등록 안내',
          body: '광고가 등록되었습니다. 앱에서 결제 후 광고를 시작해보세요.',
          type: 'ad_approved',
          navigationData: {
            type: 'ad_detail',
            params: { advertisementId },
          },
        }),
      });
    } catch (notificationError) {
      console.error('광고 등록 알림 전송 실패 (non-critical):', notificationError);
    }

    return NextResponse.json({
      success: true,
      advertisementId,
      approvedMonthlyAmount,
      totalHouseholds,
      isFirstAd,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
