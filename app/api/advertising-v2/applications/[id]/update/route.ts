import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  PRICE_LOOKUP_FAILED_MESSAGE,
  ZERO_HOUSEHOLDS_MESSAGE,
  calcMonthlyAmount,
  fetchApartmentHouseholds,
  fetchPricePerHousehold,
  repriceRunningAd,
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

interface ApartmentRow {
  apartmentId: string;
  totalHouseholds: number;
}

function sameApartments(current: ApartmentRow[], nextIds: string[]): boolean {
  const currentIds = new Set(current.map((a) => a.apartmentId));
  return currentIds.size === nextIds.length && nextIds.every((aptId) => currentIds.has(aptId));
}

async function replaceApartments(
  admin: ReturnType<typeof createAdminClient>,
  advertisementId: string,
  rows: ApartmentRow[]
): Promise<boolean> {
  const { error: deleteError } = await admin
    .from('advertisement_apartments_v2')
    .delete()
    .eq('advertisementId', advertisementId);
  if (deleteError) {
    console.error('Failed to clear apartments:', deleteError);
    return false;
  }

  const { error: insertError } = await admin
    .from('advertisement_apartments_v2')
    .insert(rows.map((row) => ({ advertisementId, ...row })));
  if (insertError) {
    console.error('Failed to insert apartments:', insertError);
    return false;
  }
  return true;
}

type ChangeResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * 광고중 광고의 노출 아파트를 관리자가 바꾼다.
 *
 * 아파트는 즉시 교체하고, 새 금액은 구독 청구액에 넣어 다음 정기결제부터 청구된다.
 * 할인율·무료기간·다음 결제일은 그대로 둔다. 차액 결제·환불·파트너 알림은 없다.
 */
async function changeRunningApartments(
  admin: ReturnType<typeof createAdminClient>,
  ad: { id: string; apartmentChangeStatus: string | null; approvedMonthlyAmount: number | null; approvedDiscountRate: number | null },
  currentApartments: ApartmentRow[],
  nextApartmentIds: string[]
): Promise<ChangeResult> {
  // 결제일·차액결제 시점에 대기 중인 아파트가 관리자가 바꾼 아파트를 덮어쓴다
  if (ad.apartmentChangeStatus) {
    return { ok: false, status: 409, error: '파트너의 아파트 변경이 대기 중입니다. 변경이 끝난 뒤 다시 시도해주세요.' };
  }

  const { data: subscription } = await admin
    .from('ad_subscriptions_v2')
    .select('id, subscriptionStatus, monthlyAmount, originalMonthlyAmount, discountRate')
    .eq('advertisementId', ad.id)
    .in('subscriptionStatus', ['active', 'grace_period', 'cancel_pending'])
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sub = subscription as {
    id: string;
    subscriptionStatus: string;
    monthlyAmount: number | null;
    originalMonthlyAmount: number | null;
    discountRate: number | null;
  } | null;

  if (!sub) {
    return { ok: false, status: 409, error: '진행 중인 구독이 없어 아파트를 변경할 수 없습니다.' };
  }
  // 재시도는 지난 주기를 청구하는데, 구독 금액을 바꾸면 새 금액으로 청구된다
  if (sub.subscriptionStatus === 'grace_period') {
    return { ok: false, status: 409, error: '결제 실패로 재시도 중인 광고는 아파트를 변경할 수 없습니다.' };
  }

  const discountRate = ad.approvedDiscountRate ?? 0;
  // 광고와 구독의 금액 근거가 어긋나 있으면 어느 쪽을 기준으로 할지 알 수 없다 — 계산하지 않는다
  if (
    sub.monthlyAmount == null ||
    sub.originalMonthlyAmount == null ||
    sub.monthlyAmount !== ad.approvedMonthlyAmount ||
    (sub.discountRate ?? 0) !== discountRate
  ) {
    return { ok: false, status: 409, error: '광고와 구독의 금액 정보가 일치하지 않아 변경할 수 없습니다. 개발팀에 문의해주세요.' };
  }

  const currentHouseholds = currentApartments.reduce((sum, a) => sum + (a.totalHouseholds ?? 0), 0);
  if (currentHouseholds <= 0) {
    return { ok: false, status: 409, error: '현재 노출 아파트의 세대수 정보가 없어 금액을 계산할 수 없습니다.' };
  }

  const households = await fetchApartmentHouseholds(admin, nextApartmentIds);
  if (nextApartmentIds.some((aptId) => !households.has(aptId))) {
    return { ok: false, status: 400, error: '세대수 정보가 없는 아파트가 있습니다. 아파트 동 정보를 먼저 등록해주세요.' };
  }
  const nextRows = nextApartmentIds.map((apartmentId) => ({
    apartmentId,
    totalHouseholds: households.get(apartmentId) ?? 0,
  }));
  const nextHouseholds = nextRows.reduce((sum, a) => sum + a.totalHouseholds, 0);
  if (nextHouseholds <= 0) {
    return { ok: false, status: 400, error: ZERO_HOUSEHOLDS_MESSAGE };
  }

  let pricePerHousehold: number;
  try {
    pricePerHousehold = await fetchPricePerHousehold(admin);
  } catch {
    return { ok: false, status: 500, error: PRICE_LOOKUP_FAILED_MESSAGE };
  }

  const repriced = repriceRunningAd(
    {
      totalHouseholds: currentHouseholds,
      monthlyAmount: sub.monthlyAmount,
      originalMonthlyAmount: sub.originalMonthlyAmount,
      discountRate,
    },
    nextHouseholds,
    pricePerHousehold
  );

  // 구독 청구액을 마지막에 바꾼다 — 앞 단계가 실패해도 청구액은 원래 그대로 남는다
  if (!(await replaceApartments(admin, ad.id, nextRows))) {
    // 지우기만 되고 넣기가 실패했을 수 있으니 원래 아파트로 되돌린다
    await replaceApartments(admin, ad.id, currentApartments);
    return { ok: false, status: 500, error: 'Failed to update apartments' };
  }

  const { error: adError } = await admin
    .from('advertisements_v2')
    .update({ approvedMonthlyAmount: repriced.monthlyAmount })
    .eq('id', ad.id);
  if (adError) {
    console.error('Failed to update approvedMonthlyAmount:', adError);
    await replaceApartments(admin, ad.id, currentApartments);
    return { ok: false, status: 500, error: 'Failed to update advertisement' };
  }

  const { error: subError } = await admin
    .from('ad_subscriptions_v2')
    .update({
      monthlyAmount: repriced.monthlyAmount,
      originalMonthlyAmount: repriced.originalMonthlyAmount,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', sub.id);
  if (subError) {
    console.error('Failed to update subscription amount:', subError);
    await admin
      .from('advertisements_v2')
      .update({ approvedMonthlyAmount: ad.approvedMonthlyAmount })
      .eq('id', ad.id);
    await replaceApartments(admin, ad.id, currentApartments);
    return { ok: false, status: 500, error: 'Failed to update subscription' };
  }

  console.log(
    `[admin-apartment-change] ad=${ad.id} method=${repriced.method} households=${currentHouseholds}->${nextHouseholds} ` +
    `monthly=${sub.monthlyAmount}->${repriced.monthlyAmount} original=${sub.originalMonthlyAmount}->${repriced.originalMonthlyAmount}`
  );
  return { ok: true };
}

/**
 * 관리자가 광고를 고친다.
 *
 * 결제 전(approved + unpaid)은 전부 고칠 수 있다 — 청구가 아직 없으므로 금액이 바뀌어도 된다.
 * 광고중(running)은 내용과 노출 아파트를 고친다. 아파트가 바뀌면 청구액을 다시 계산해
 * 다음 정기결제부터 적용한다(changeRunningApartments). 할인·무료기간은 바꾸지 않는다.
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
      .select('id, partnerId, adStatus, paymentStatus, modificationStatus, isFirstAdApplication, apartmentChangeStatus, approvedMonthlyAmount, approvedDiscountRate')
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
      apartmentChangeStatus: string | null;
      approvedMonthlyAmount: number | null;
      approvedDiscountRate: number | null;
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

    // 광고중 — 아파트가 바뀌었으면 먼저 교체·재계산하고(실패하면 아무것도 바꾸지 않음), 내용을 고친다
    if (isRunning) {
      if (uniqueApartmentIds.length === 0) {
        return NextResponse.json(
          { error: '노출할 아파트를 1곳 이상 선택해주세요.' },
          { status: 400 }
        );
      }

      const { data: currentAptData, error: currentAptError } = await admin
        .from('advertisement_apartments_v2')
        .select('apartmentId, totalHouseholds')
        .eq('advertisementId', id);
      if (currentAptError) {
        console.error('Failed to fetch current apartments:', currentAptError);
        return NextResponse.json({ error: 'Failed to fetch apartments' }, { status: 500 });
      }
      const currentApartments = (currentAptData ?? []) as ApartmentRow[];

      if (!sameApartments(currentApartments, uniqueApartmentIds)) {
        const changed = await changeRunningApartments(
          admin,
          {
            id,
            apartmentChangeStatus: existing.apartmentChangeStatus,
            approvedMonthlyAmount: existing.approvedMonthlyAmount,
            approvedDiscountRate: existing.approvedDiscountRate,
          },
          currentApartments,
          uniqueApartmentIds
        );
        if (!changed.ok) {
          return NextResponse.json({ error: changed.error }, { status: changed.status });
        }
      }

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

    // 동 정보는 있지만 세대수가 비어 있으면 합계 0 → 월 금액 0원이 저장된다. 여기서 막는다.
    if (totalHouseholds <= 0) {
      return NextResponse.json({ error: ZERO_HOUSEHOLDS_MESSAGE }, { status: 400 });
    }

    // 첫 광고 여부는 등록 시점에 확정된 값을 그대로 쓴다.
    // 지금 다시 판정하면 자기 자신이 걸려 항상 false가 된다.
    const isFirstAd = existing.isFirstAdApplication === true;
    const { discountRate, freeMonths } = resolveBenefits({
      isFirstAd,
      overrideEnabled,
      discountRate: body.discountRate,
      freeMonths: body.freeMonths,
    });

    let pricePerHousehold: number;
    try {
      pricePerHousehold = await fetchPricePerHousehold(admin);
    } catch {
      return NextResponse.json({ error: PRICE_LOOKUP_FAILED_MESSAGE }, { status: 500 });
    }
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
