import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 토스 에러코드 → 사용자 친화적 메시지 변환 (charge-billing과 동일 패턴)
function getBillingFailMessage(errorCode: string): string {
  switch (errorCode) {
    case 'REJECT_CARD_PAYMENT':
      return '한도초과 또는 잔액부족으로 결제에 실패했습니다.'
    case 'REJECT_ACCOUNT_PAYMENT':
      return '잔액부족으로 결제에 실패했습니다.'
    case 'INVALID_STOPPED_CARD':
      return '정지된 카드로 결제에 실패했습니다. 앱에서 카드를 다시 등록해주세요.'
    case 'INVALID_CARD_EXPIRATION':
      return '카드 유효기간이 만료되었습니다. 앱에서 카드를 다시 등록해주세요.'
    case 'INVALID_CARD_NUMBER':
    case 'INVALID_BILL_KEY_REQUEST':
      return '카드 정보가 유효하지 않습니다. 앱에서 카드를 다시 등록해주세요.'
    case 'NOT_SUPPORTED_CARD_TYPE':
      return '지원되지 않는 카드 종류입니다. 다른 카드로 등록해주세요.'
    case 'NOT_REGISTERED_CARD_COMPANY':
      return '카드 등록이 필요합니다. 앱에서 카드를 다시 등록해주세요.'
    case 'INVALID_REJECT_CARD':
      return '카드 사용이 거절되었습니다. 카드사에 문의해주세요.'
    case 'REJECT_CARD_COMPANY':
      return '카드사에서 결제를 거절했습니다. 카드사에 문의해주세요.'
    case 'EXCEED_MAX_AUTH_COUNT':
      return '카드 인증 횟수를 초과했습니다. 카드사에 문의해주세요.'
    case 'FAILED_CARD_COMPANY_RESPONSE':
    case 'FAILED_INTERNAL_SYSTEM_PROCESSING':
    case 'FAILED_DB_PROCESSING':
    case 'COMMON_ERROR':
      return '일시적인 오류로 결제에 실패했습니다. 잠시 후 다시 시도해주세요.'
    default:
      return '결제에 실패했습니다. 앱에서 카드 정보를 확인해주세요.'
  }
}

// 월 결제금액 계산 (Design Ref: §5.1)
// approvedDiscountRate: DB 저장값 (비첫광고=0, 첫광고=할인율)
function calculateFee(
  totalHouseholds: number,
  pricePerHousehold: number,
  discountRate: number,
): number {
  const original = Math.round((totalHouseholds * pricePerHousehold) / 10) * 10
  return Math.round((original * (100 - discountRate)) / 100 / 10) * 10
}

// 일할계산: 호출 시점 now() 기준으로 남은 기간 비율만큼 차액 산출
// billingAnchorDay + nextBillingDate로 사이클 시작일을 역산
// Flutter proration_utils.dart와 동일 로직 유지 필수
function calculateProrated(
  monthlyDiff: number,
  nextBillingDate: Date,
  billingAnchorDay: number,
): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  const now = new Date()

  // 날짜 단위로만 비교 (오후 결제 시 1일 손실 방지)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const billingDay = new Date(nextBillingDate.getFullYear(), nextBillingDate.getMonth(), nextBillingDate.getDate())

  // 남은 일수: 당일 포함(+1)하되 0 이하이면 만료
  const diffMs = billingDay.getTime() - today.getTime()
  const remainingDays = diffMs < 0 ? 0 : Math.round(diffMs / MS_PER_DAY) + 1

  // 사이클 시작일 역산: nextBillingDate에서 1개월 전 anchorDay
  const periodStart = new Date(nextBillingDate)
  periodStart.setDate(1)
  periodStart.setMonth(periodStart.getMonth() - 1)
  const daysInStartMonth = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate()
  periodStart.setDate(Math.min(billingAnchorDay, daysInStartMonth))

  const totalDays = Math.round((billingDay.getTime() - periodStart.getTime()) / MS_PER_DAY)

  if (totalDays <= 0 || remainingDays <= 0) return 0

  // 사이클 초반(남은 일수 ≥ 전체 일수)이면 전액
  if (remainingDays >= totalDays) return monthlyDiff

  const prorated = Math.round((monthlyDiff * remainingDays / totalDays) / 10) * 10
  return Math.min(Math.max(0, prorated), monthlyDiff)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const BILLING_KEY_SECRET = Deno.env.get('BILLING_KEY_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const TOSS_BILLING_SECRET_KEY = Deno.env.get('TOSS_BILLING_SECRET_KEY')

    if (!BILLING_KEY_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !TOSS_BILLING_SECRET_KEY) {
      throw new Error('필수 환경 변수가 설정되지 않았습니다.')
    }

    const { advertisementId, billingKeyId } = await req.json()

    if (!advertisementId || !billingKeyId) {
      return new Response(
        JSON.stringify({ error: 'advertisementId, billingKeyId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. 광고 정보 조회
    const { data: ad, error: adError } = await supabase
      .from('advertisements_v2')
      .select(
        'id, "partnerId", "approvedDiscountRate", "approvedMonthlyAmount", "pendingChanges", "apartmentChangeStatus"',
      )
      .eq('id', advertisementId)
      .single()

    if (adError || !ad) {
      throw new Error(`광고 조회 실패: ${adError?.message}`)
    }

    // 이미 처리 완료된 경우 idempotent 처리
    if (ad.apartmentChangeStatus !== 'pending_payment') {
      return new Response(
        JSON.stringify({ error: '차액 결제 대기 상태가 아닙니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const pendingApartments: { apartmentId: string; totalHouseholds: number }[] =
      ad.pendingChanges?.apartments ?? []

    if (pendingApartments.length === 0) {
      return new Response(
        JSON.stringify({ error: 'pendingChanges에 apartments 데이터가 없습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. 빌링키 유효성 검증 (해당 파트너 소유 여부) + customerKey 조회
    const { data: billingKey, error: keyError } = await supabase
      .from('ad_billing_keys_v2')
      .select('id, "customerKey"')
      .eq('id', billingKeyId)
      .eq('partnerId', ad.partnerId)
      .eq('isActive', true)
      .maybeSingle()

    if (keyError || !billingKey) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 카드입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 빌링키 복호화 (DB에 AES-256 암호화로 저장됨)
    const { data: decryptedKey, error: decryptError } = await supabase.rpc(
      'decrypt_billing_key',
      { p_billing_key_id: billingKeyId, p_billing_key_secret: BILLING_KEY_SECRET },
    )

    if (decryptError || !decryptedKey) {
      throw new Error(`빌링키 복호화 실패: ${decryptError?.message}`)
    }

    // 3. 현재 아파트 총 세대수 조회
    const { data: currentApartments } = await supabase
      .from('advertisement_apartments_v2')
      .select('"totalHouseholds"')
      .eq('advertisementId', advertisementId)

    const currentTotalHouseholds = (currentApartments ?? []).reduce(
      (sum: number, a: { totalHouseholds: number }) => sum + a.totalHouseholds,
      0,
    )

    // 4. 단가 조회
    const { data: pricing } = await supabase
      .from('ad_pricing_v2')
      .select('"pricePerHousehold"')
      .order('effectiveFrom', { ascending: false })
      .limit(1)
      .single()

    const pricePerHousehold = pricing?.pricePerHousehold ?? 70
    const discountRate: number = ad.approvedDiscountRate ?? 0

    // 5. 구독 조회 (일할계산용 nextBillingDate + billingAnchorDay, 다음 결제 금액 갱신용)
    const { data: subscription } = await supabase
      .from('ad_subscriptions_v2')
      .select('id, "nextBillingDate", "billingAnchorDay"')
      .eq('advertisementId', advertisementId)
      .in('subscriptionStatus', ['active', 'grace_period', 'cancel_pending'])
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 6. 일할계산 — 호출 시점 now() 기준으로 동적 산출 (DB 저장값 사용 안 함)
    const newTotalHouseholds = pendingApartments.reduce(
      (sum, a) => sum + a.totalHouseholds,
      0,
    )
    const newMonthlyFee = calculateFee(newTotalHouseholds, pricePerHousehold, discountRate)
    const currentMonthlyFee = ad.approvedMonthlyAmount ??
      calculateFee(currentTotalHouseholds, pricePerHousehold, discountRate)
    const monthlyDiff = newMonthlyFee - currentMonthlyFee

    let diffAmount: number
    if (subscription?.nextBillingDate) {
      const nextBillingDate = new Date(subscription.nextBillingDate)
      const anchorDay: number = subscription.billingAnchorDay ?? nextBillingDate.getUTCDate()
      diffAmount = calculateProrated(monthlyDiff, nextBillingDate, anchorDay)
    } else {
      // 구독 정보 없는 경우 전액 폴백
      diffAmount = monthlyDiff
    }

    if (diffAmount <= 0) {
      return new Response(
        JSON.stringify({ error: '일할계산 결과 차액이 0원 이하입니다. 다음 정기결제일 이후에는 차액 결제가 불필요합니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 7. Toss Payments 차액 결제
    const now = new Date()
    const orderId = `apt-diff-${advertisementId.substring(0, 8)}-${now.getTime()}`
    const orderName = `광고 아파트 변경 차액 결제`

    const tossResponse = await fetch(
      `https://api.tosspayments.com/v1/billing/${decryptedKey}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(TOSS_BILLING_SECRET_KEY + ':')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: billingKey.customerKey,
          amount: diffAmount,
          orderId,
          orderName,
        }),
      },
    )

    const tossData = await tossResponse.json()

    if (!tossResponse.ok || tossData.status !== 'DONE') {
      console.error('[charge-apartment-difference] 토스 결제 실패:', tossData)

      // 결제 실패 FCM 알림 (non-critical)
      try {
        const failMessage = getBillingFailMessage(tossData.code ?? '')
        await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            partnerUserId: ad.partnerId,
            title: '차액 결제 실패',
            body: failMessage,
            type: 'billing_failed',
            navigationData: { type: 'ad_detail', params: { advertisementId } },
          }),
        })
      } catch (notiErr) {
        console.error(`[charge-apartment-difference] 결제 실패 FCM 알림 전송 실패 (non-critical): ${notiErr}`)
      }

      return new Response(
        JSON.stringify({ error: `결제 실패: ${tossData.message ?? '알 수 없는 오류'}` }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 9. 결제 성공 — DB 업데이트
    //    결제 성공 직후 processing으로 변경 → 이후 DB 실패 시 재결제 방지
    await supabase
      .from('advertisements_v2')
      .update({ apartmentChangeStatus: 'processing' })
      .eq('id', advertisementId)

    //    a. advertisement_apartments_v2: 기존 rows 삭제 → pendingChanges.apartments INSERT
    const { error: deleteError } = await supabase
      .from('advertisement_apartments_v2')
      .delete()
      .eq('advertisementId', advertisementId)

    if (deleteError) {
      console.error('[charge-apartment-difference] 기존 아파트 삭제 실패:', deleteError)
      throw new Error(`아파트 삭제 실패: ${deleteError.message}`)
    }

    const { error: insertError } = await supabase
      .from('advertisement_apartments_v2')
      .insert(
        pendingApartments.map((a) => ({
          advertisementId,
          apartmentId: a.apartmentId,
          totalHouseholds: a.totalHouseholds,
        })),
      )

    if (insertError) {
      console.error('[charge-apartment-difference] 신규 아파트 INSERT 실패:', insertError)
      throw new Error(`아파트 INSERT 실패: ${insertError.message}`)
    }

    //    b. advertisements_v2: 텍스트 변경사항 + apartmentChangeStatus 정리
    //       케이스 2는 승인 시 텍스트를 적용하지 않고 pendingChanges에 보존했으므로 여기서 일괄 적용
    const { subCategoryIds: pendingSubCategoryIds, apartments: _apartments, ...adTextChanges } =
      (ad.pendingChanges ?? {}) as Record<string, unknown>

    const { error: adUpdateError } = await supabase
      .from('advertisements_v2')
      .update({
        ...adTextChanges,           // 텍스트/이미지/링크 등 변경사항 적용
        apartmentChangeStatus: null,
        pendingChanges: null,
        approvedMonthlyAmount: newMonthlyFee,
      })
      .eq('id', advertisementId)

    if (adUpdateError) {
      throw new Error(`광고 상태 업데이트 실패: ${adUpdateError.message}`)
    }

    // 서브카테고리 junction table 업데이트 (pendingChanges에 포함된 경우)
    if (Array.isArray(pendingSubCategoryIds)) {
      try {
        await supabase
          .from('advertisement_sub_categories_v2')
          .delete()
          .eq('advertisementId', advertisementId)

        if ((pendingSubCategoryIds as string[]).length > 0) {
          await supabase
            .from('advertisement_sub_categories_v2')
            .insert(
              (pendingSubCategoryIds as string[]).map((subId) => ({
                advertisementId,
                subCategoryId: subId,
              })),
            )
        }
      } catch (subCatError) {
        console.error('[charge-apartment-difference] 서브카테고리 업데이트 실패 (non-critical):', subCatError)
      }
    }

    // 구독 monthlyAmount 갱신 (다음 정기결제부터 신규 금액 청구)
    if (subscription?.id) {
      await supabase
        .from('ad_subscriptions_v2')
        .update({ monthlyAmount: newMonthlyFee })
        .eq('id', subscription.id)
    }

    //    c. ad_payment_history_v2: 결제 이력 INSERT (best-effort)
    if (subscription?.id) {
      try {
        await supabase.from('ad_payment_history_v2').insert({
          subscriptionId: subscription.id,
          billingKeyId,
          amount: diffAmount,
          supplyAmount: Math.round(diffAmount / 1.1),
          vatAmount: diffAmount - Math.round(diffAmount / 1.1),
          status: 'paid',
          paymentDate: now.toISOString(),
          paymentKey: tossData.paymentKey ?? null,
          receiptUrl: tossData.receipt?.url ?? null,
          billingPeriodStart: now.toISOString(),
          billingPeriodEnd: now.toISOString(),
        })
      } catch (historyError) {
        console.error('[charge-apartment-difference] 결제 이력 INSERT 실패 (non-critical):', historyError)
      }
    }

    // 결제 완료 FCM 알림 (non-critical)
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
      const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerUserId: ad.partnerId,
          title: '결제 완료',
          body: `${diffAmount.toLocaleString()}원 결제가 완료되었습니다.`,
          type: 'billing_success',
          navigationData: { type: 'ad_detail', params: { advertisementId } },
        }),
      })
    } catch (notiErr) {
      console.error(`[charge-apartment-difference] FCM 알림 전송 실패 (non-critical): ${notiErr}`)
    }

    console.log(
      `[charge-apartment-difference] 완료 - advertisementId: ${advertisementId}, charged: ${diffAmount}`,
    )

    return new Response(
      JSON.stringify({ success: true, diffAmount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[charge-apartment-difference] 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
