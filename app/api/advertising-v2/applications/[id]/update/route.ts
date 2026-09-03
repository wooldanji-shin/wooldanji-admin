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
import {
  canStartWithoutCard,
  insertCardlessSubscription,
  startedAdColumns,
} from '@/lib/ads/start-without-card';

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
  startImmediately?: boolean;
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
  body: UpdateBody,
  startedWithoutCard: boolean
): Promise<void> {
  const partnerUpdate: Record<string, unknown> = {};
  if (body.bizCallNumber !== undefined) {
    partnerUpdate.bizCallNumber = trimmedOrNull(body.bizCallNumber);
  }
  if (body.grantAnalytics !== undefined) {
    partnerUpdate.analyticsEnabled = body.grantAnalytics === true;
  }
  // 운영까지 간 광고가 생겼다는 표식 — 남기지 않으면 다음 광고에도 첫 광고 혜택이 또 붙는다
  if (startedWithoutCard) {
    partnerUpdate.hasHadRunningAd = true;
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

      // 광고중 광고는 이미 개시된 상태라 첫 광고 표식을 새로 남길 일이 없다
      await updatePartner(admin, existing.partnerId, body, false);

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

    // 결제 전 광고만 카드 없이 개시할 수 있다 — running은 이미 개시된 상태다
    const startImmediately =
      isBeforePayment && canStartWithoutCard(body.startImmediately, discountRate);

    const { error: updateError } = await admin
      .from('advertisements_v2')
      .update({
        ...contentColumns(body, ctaButtons),
        freeMonths,
        approvedDiscountRate: discountRate,
        approvedMonthlyAmount,
        discountNote: trimmedOrNull(body.discountNote),
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

    // 카드 없이 개시 — 파트너 결제를 기다리지 않고 바로 노출을 시작한다.
    // 구독을 먼저 만든다: 실패해도 광고는 결제 전 상태 그대로 남아 다시 시도할 수 있다.
    if (startImmediately) {
      const startedAt = new Date().toISOString();

      const subscriptionError = await insertCardlessSubscription(admin, {
        advertisementId: id,
        originalMonthlyAmount: calcMonthlyAmount(totalHouseholds, pricePerHousehold, 0),
        discountRate,
        monthlyAmount: approvedMonthlyAmount,
        startedAt,
      });

      if (subscriptionError) {
        return NextResponse.json({ error: subscriptionError }, { status: 500 });
      }

      const { error: startError } = await admin
        .from('advertisements_v2')
        .update(startedAdColumns(startedAt))
        .eq('id', id);

      // running으로 못 넘겼는데 구독만 남으면 파트너가 결제 시 구독이 두 개가 된다
      if (startError) {
        console.error('Failed to start advertisement:', startError);
        await admin.from('ad_subscriptions_v2').delete().eq('advertisementId', id);
        return NextResponse.json({ error: 'Failed to start advertisement' }, { status: 500 });
      }
    }

    await updatePartner(admin, existing.partnerId, body, startImmediately);

    // 광고 시작 알림 (non-critical: 실패해도 개시는 유지)
    if (startImmediately) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-partner-fcm-notification`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              partnerUserId: existing.partnerId,
              title: '광고 시작 안내',
              body: '광고가 시작되었습니다. 앱에서 확인해보세요.',
              type: 'ad_approved',
              navigationData: { type: 'ad_detail', params: { advertisementId: id } },
            }),
          }
        );
      } catch (notificationError) {
        console.error('광고 시작 알림 전송 실패 (non-critical):', notificationError);
      }
    }

    return NextResponse.json({
      success: true,
      advertisementId: id,
      approvedMonthlyAmount,
      totalHouseholds,
      startImmediately,
    });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
