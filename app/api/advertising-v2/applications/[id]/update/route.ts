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
import { BIZ_CALL_DUPLICATE_MESSAGE, findBizCallDuplicate } from '@/lib/biz-call';

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

/** 청구 금액의 근거(아파트·할인·무료기간)와 무관한 컬럼 — 광고중에도 고칠 수 있다 */
function contentColumns(body: UpdateBody, ctaButtons: CtaButton[]) {
  return {
    categoryId: body.categoryId,
    title: body.title.trim(),
    content: trimmedOrNull(body.content),
    imageUrls: body.imageUrls ?? [],
    naverMapUrl: trimmedOrNull(body.naverMapUrl),
    blogUrl: trimmedOrNull(body.blogUrl),
    youtubeUrl: trimmedOrNull(body.youtubeUrl),
    instagramUrl: trimmedOrNull(body.instagramUrl),
    kakaoOpenChatUrl: trimmedOrNull(body.kakaoOpenChatUrl),
    baeminUrl: ctaUrlOfType(ctaButtons, 'baemin'),
    coupangEatsUrl: ctaUrlOfType(ctaButtons, 'coupangEats'),
    ctaButtons: ctaButtons.length > 0 ? ctaButtons : null,
    adminMemo: trimmedOrNull(body.adminMemo),
    salesRepId: body.salesRepId || null,
    updatedAt: new Date().toISOString(),
  };
}

/** 서브카테고리는 통째로 교체한다 — 문제가 있으면 메시지, 없으면 null */
async function replaceSubCategories(
  admin: ReturnType<typeof createAdminClient>,
  advertisementId: string,
  subCategoryIds: string[]
): Promise<string | null> {
  const { error: deleteError } = await admin
    .from('advertisement_sub_categories_v2')
    .delete()
    .eq('advertisementId', advertisementId);

  if (deleteError) {
    console.error('Failed to clear sub categories:', deleteError);
    return 'Failed to update sub categories';
  }

  if (subCategoryIds.length === 0) return null;

  const { error: insertError } = await admin
    .from('advertisement_sub_categories_v2')
    .insert(subCategoryIds.map((subCategoryId) => ({ advertisementId, subCategoryId })));

  if (insertError) {
    console.error('Failed to insert sub categories:', insertError);
    return 'Failed to update sub categories';
  }

  return null;
}

/** 비즈콜·분석 권한은 광고가 아니라 파트너에 붙어 있다 */
async function updatePartner(
  admin: ReturnType<typeof createAdminClient>,
  partnerId: string,
  body: UpdateBody
): Promise<void> {
  const partnerUpdate: Record<string, unknown> = {};
  if (body.bizCallNumber !== undefined) {
    partnerUpdate.bizCallNumber = trimmedOrNull(body.bizCallNumber);
  }
  if (body.grantAnalytics !== undefined) {
    partnerUpdate.analyticsEnabled = body.grantAnalytics === true;
  }
  if (Object.keys(partnerUpdate).length === 0) return;

  const { error } = await admin
    .from('partner_users')
    .update(partnerUpdate)
    .eq('id', partnerId);

  if (error) console.error('Failed to update partner:', error);
}

/**
 * 관리자가 광고를 고친다.
 *
 * 결제 전(approved + unpaid)은 전부 고칠 수 있다 — 청구가 아직 없으므로 금액이 바뀌어도 된다.
 * 광고중(running)은 카테고리·내용·이미지·링크·CTA·비즈콜만 고친다. 아파트·할인·무료기간은
 * 이미 돌고 있는 구독 청구액의 근거라, 바꾸려면 파트너의 수정 심사 흐름을 따라야 한다.
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

    const admin = createAdminClient();

    const { data: ad } = await admin
      .from('advertisements_v2')
      .select('id, partnerId, adStatus, paymentStatus, modificationStatus, isFirstAdApplication')
      .eq('id', id)
      .maybeSingle();

    if (!ad) {
      return NextResponse.json({ error: '광고를 찾을 수 없습니다.' }, { status: 404 });
    }

    const existing = ad as {
      partnerId: string;
      adStatus: string;
      paymentStatus: string;
      modificationStatus: string | null;
      isFirstAdApplication: boolean | null;
    };

    const isRunning = existing.adStatus === 'running';
    const isBeforePayment =
      existing.adStatus === 'approved' && existing.paymentStatus === 'unpaid';

    if (!isRunning && !isBeforePayment) {
      return NextResponse.json(
        { error: '결제 전(승인·미결제) 또는 광고중인 광고만 수정할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 파트너 수정 심사가 걸려 있는데 여기서 덮어쓰면, 승인 시 어느 쪽 값이 남는지 알 수 없다
    if (isRunning && existing.modificationStatus === 'pending') {
      return NextResponse.json(
        { error: '파트너의 수정 심사가 진행 중입니다. 먼저 승인하거나 거절해주세요.' },
        { status: 409 }
      );
    }

    // 같은 번호를 두 파트너가 쓰면 앱에서 어느 광고로 걸려온 문의인지 구분할 수 없다
    const bizCallOwner = await findBizCallDuplicate(
      admin,
      body.bizCallNumber,
      existing.partnerId
    );
    if (bizCallOwner) {
      return NextResponse.json(
        { error: `${BIZ_CALL_DUPLICATE_MESSAGE} (${bizCallOwner.businessName})` },
        { status: 409 }
      );
    }

    // 광고중이면 금액의 근거는 그대로 두고 내용만 바꾼다
    if (isRunning) {
      const { error: runningUpdateError } = await admin
        .from('advertisements_v2')
        .update(contentColumns(body, ctaButtons))
        .eq('id', id);

      if (runningUpdateError) {
        console.error('Failed to update advertisement:', runningUpdateError);
        return NextResponse.json({ error: 'Failed to update advertisement' }, { status: 500 });
      }

      const subCategoryError = await replaceSubCategories(admin, id, subCategoryIds);
      if (subCategoryError) {
        return NextResponse.json({ error: subCategoryError }, { status: 500 });
      }

      await updatePartner(admin, existing.partnerId, body);

      return NextResponse.json({ success: true, advertisementId: id });
    }

    if (uniqueApartmentIds.length === 0) {
      return NextResponse.json(
        { error: '노출할 아파트를 1곳 이상 선택해주세요.' },
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
        ...contentColumns(body, ctaButtons),
        freeMonths,
        approvedDiscountRate: discountRate,
        approvedMonthlyAmount,
        discountNote: overrideEnabled === true ? trimmedOrNull(body.discountNote) : null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update advertisement:', updateError);
      return NextResponse.json({ error: 'Failed to update advertisement' }, { status: 500 });
    }

    // 아파트는 통째로 교체한다
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

    const subCategoryError = await replaceSubCategories(admin, id, subCategoryIds);
    if (subCategoryError) {
      return NextResponse.json({ error: subCategoryError }, { status: 500 });
    }

    await updatePartner(admin, existing.partnerId, body);

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
