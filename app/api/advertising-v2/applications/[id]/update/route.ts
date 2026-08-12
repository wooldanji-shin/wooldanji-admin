import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  calcMonthlyAmount,
  fetchApartmentHouseholds,
  fetchPricePerHousehold,
  resolveBenefits,
} from '@/lib/ads/pricing';
import { ctaButtonsError, ctaUrlOfType, type CtaButton } from '@/lib/cta-button';
import { MAX_AD_IMAGES } from '@/lib/ads/constants';

interface UpdateBody {
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
 * 관리자가 대리 등록한 광고를 고친다 (잘못 등록한 경우의 정정).
 *
 * 결제 전(approved + unpaid) 광고만 허용한다. 결제가 끝난 광고는 구독이 이미 돌고 있어
 * 아파트·금액을 여기서 바꾸면 청구와 어긋나므로, 파트너의 수정 심사 흐름을 따라야 한다.
 *
 * 파트너는 바꿀 수 없다 — 다른 파트너의 광고는 새로 등록하는 것과 같다.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json() as UpdateBody;
    const {
      categoryId,
      subCategoryIds = [],
      title,
      apartmentIds = [],
      imageUrls = [],
      ctaButtons = [],
      overrideEnabled,
      grantAnalytics,
    } = body;

    if (!categoryId || !title?.trim()) {
      return NextResponse.json(
        { error: '카테고리·제목은 필수입니다.' },
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

    const uniqueApartmentIds = [...new Set(apartmentIds)];
    if (uniqueApartmentIds.length === 0) {
      return NextResponse.json(
        { error: '노출할 아파트를 1곳 이상 선택해주세요.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: ad } = await admin
      .from('advertisements_v2')
      .select('id, partnerId, adStatus, paymentStatus, isFirstAdApplication')
      .eq('id', id)
      .maybeSingle();

    if (!ad) {
      return NextResponse.json({ error: '광고를 찾을 수 없습니다.' }, { status: 404 });
    }

    const existing = ad as {
      partnerId: string;
      adStatus: string;
      paymentStatus: string;
      isFirstAdApplication: boolean | null;
    };

    if (existing.adStatus !== 'approved' || existing.paymentStatus !== 'unpaid') {
      return NextResponse.json(
        { error: '결제 전(승인·미결제) 광고만 수정할 수 있습니다.' },
        { status: 400 }
      );
    }

    const households = await fetchApartmentHouseholds(admin, uniqueApartmentIds);
    const missing = uniqueApartmentIds.filter((aptId) => !households.has(aptId));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: '세대수 정보가 없는 아파트가 있습니다. 아파트 동 정보를 먼저 등록해주세요.' },
        { status: 400 }
      );
    }

    const totalHouseholds = [...households.values()].reduce((sum, n) => sum + n, 0);

    // 첫 광고 여부는 등록 시점에 확정된 값을 그대로 쓴다.
    // 지금 다시 판정하면 자기 자신이 걸려 항상 false가 된다.
    const isFirstAd = existing.isFirstAdApplication === true;
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

    const { error: updateError } = await admin
      .from('advertisements_v2')
      .update({
        categoryId,
        title: title.trim(),
        content: trimmedOrNull(body.content),
        imageUrls,
        naverMapUrl: trimmedOrNull(body.naverMapUrl),
        blogUrl: trimmedOrNull(body.blogUrl),
        youtubeUrl: trimmedOrNull(body.youtubeUrl),
        instagramUrl: trimmedOrNull(body.instagramUrl),
        kakaoOpenChatUrl: trimmedOrNull(body.kakaoOpenChatUrl),
        baeminUrl: ctaUrlOfType(ctaButtons, 'baemin'),
        coupangEatsUrl: ctaUrlOfType(ctaButtons, 'coupangEats'),
        ctaButtons: ctaButtons.length > 0 ? ctaButtons : null,
        freeMonths,
        approvedDiscountRate: discountRate,
        approvedMonthlyAmount,
        updatedAt: new Date().toISOString(),
        discountNote: overrideEnabled === true ? trimmedOrNull(body.discountNote) : null,
        adminMemo: trimmedOrNull(body.adminMemo),
        salesRepId: body.salesRepId || null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update advertisement:', updateError);
      return NextResponse.json({ error: 'Failed to update advertisement' }, { status: 500 });
    }

    // 아파트·서브카테고리는 통째로 교체한다
    const { error: apartmentDeleteError } = await admin
      .from('advertisement_apartments_v2')
      .delete()
      .eq('advertisementId', id);

    if (apartmentDeleteError) {
      console.error('Failed to clear apartments:', apartmentDeleteError);
      return NextResponse.json({ error: 'Failed to update apartments' }, { status: 500 });
    }

    const { error: apartmentInsertError } = await admin
      .from('advertisement_apartments_v2')
      .insert(
        uniqueApartmentIds.map((apartmentId) => ({
          advertisementId: id,
          apartmentId,
          totalHouseholds: households.get(apartmentId) ?? 0,
        }))
      );

    if (apartmentInsertError) {
      console.error('Failed to insert apartments:', apartmentInsertError);
      return NextResponse.json({ error: 'Failed to update apartments' }, { status: 500 });
    }

    const { error: subCategoryDeleteError } = await admin
      .from('advertisement_sub_categories_v2')
      .delete()
      .eq('advertisementId', id);

    if (subCategoryDeleteError) {
      console.error('Failed to clear sub categories:', subCategoryDeleteError);
      return NextResponse.json({ error: 'Failed to update sub categories' }, { status: 500 });
    }

    if (subCategoryIds.length > 0) {
      const { error: subCategoryInsertError } = await admin
        .from('advertisement_sub_categories_v2')
        .insert(
          subCategoryIds.map((subCategoryId) => ({ advertisementId: id, subCategoryId }))
        );

      if (subCategoryInsertError) {
        console.error('Failed to insert sub categories:', subCategoryInsertError);
        return NextResponse.json({ error: 'Failed to update sub categories' }, { status: 500 });
      }
    }

    const partnerUpdate: Record<string, unknown> = {};
    if (body.bizCallNumber !== undefined) {
      partnerUpdate.bizCallNumber = trimmedOrNull(body.bizCallNumber);
    }
    if (grantAnalytics !== undefined) {
      partnerUpdate.analyticsEnabled = grantAnalytics === true;
    }
    if (Object.keys(partnerUpdate).length > 0) {
      const { error: partnerError } = await admin
        .from('partner_users')
        .update(partnerUpdate)
        .eq('id', existing.partnerId);

      if (partnerError) {
        console.error('Failed to update partner:', partnerError);
      }
    }

    return NextResponse.json({
      success: true,
      advertisementId: id,
      approvedMonthlyAmount,
      totalHouseholds,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
