import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// grace period 일수
const GRACE_PERIOD_DAYS = 3

// 토스페이먼츠 에러 코드 → 사용자 친화적 메시지 변환 (카드 자동결제 승인 기준)
function getBillingFailMessage(errorCode: string): string {
  switch (errorCode) {
    // 잔액/한도
    case 'REJECT_CARD_PAYMENT':
      return '한도초과 또는 잔액부족으로 결제에 실패했습니다.'
    case 'REJECT_ACCOUNT_PAYMENT':
      return '잔액부족으로 결제에 실패했습니다.'
    // 카드 상태 문제 → 파트너가 카드 교체/재등록 필요
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
    // 카드사 거절 → 카드사 문의 필요
    case 'INVALID_REJECT_CARD':
      return '카드 사용이 거절되었습니다. 카드사에 문의해주세요.'
    case 'REJECT_CARD_COMPANY':
      return '카드사에서 결제를 거절했습니다. 카드사에 문의해주세요.'
    case 'EXCEED_MAX_AUTH_COUNT':
      return '카드 인증 횟수를 초과했습니다. 카드사에 문의해주세요.'
    // 일시적 오류 → 자동 재시도 안내
    case 'FAILED_CARD_COMPANY_RESPONSE':
    case 'FAILED_INTERNAL_SYSTEM_PROCESSING':
    case 'FAILED_DB_PROCESSING':
    case 'COMMON_ERROR':
      return '일시적인 오류로 결제에 실패했습니다. 잠시 후 자동으로 재시도됩니다.'
    default:
      return '정기결제에 실패했습니다. 앱에서 카드 정보를 확인해주세요.'
  }
}

// anchor 기준으로 1개월 후 날짜 계산
// 예) anchor=31, 1월 → 2월 28일 / 3월 31일
function addOneMonth(date: Date, anchorDay: number): Date {
  const result = new Date(date)
  result.setDate(1)
  result.setMonth(result.getMonth() + 1)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(anchorDay, lastDay))
  return result
}

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const TOSS_BILLING_SECRET_KEY = Deno.env.get('TOSS_BILLING_SECRET_KEY')
    const BILLING_KEY_SECRET = Deno.env.get('BILLING_KEY_SECRET')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!TOSS_BILLING_SECRET_KEY || !BILLING_KEY_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('필수 환경 변수가 설정되지 않았습니다.')
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const now = new Date()

    // 오늘 하루 끝 (UTC 23:59:59.999) — nextBillingDate 저장 시각과 무관하게 당일 결제 보장
    const endOfToday = new Date(now)
    endOfToday.setUTCHours(23, 59, 59, 999)

    // 0. cancel_pending 구독 중 cancelEffectiveAt 도래한 것 만료 처리
    //    Plan SC: cancel_pending + cancelEffectiveAt <= now → expired + adStatus=ended
    {
      const { data: cancelledSubs } = await supabase
        .from('ad_subscriptions_v2')
        .select('id, "advertisementId", advertisements_v2!inner("partnerId")')
        .eq('subscriptionStatus', 'cancel_pending')
        .lte('cancelEffectiveAt', endOfToday.toISOString())

      for (const sub of cancelledSubs ?? []) {
        try {
          await supabase
            .from('ad_subscriptions_v2')
            .update({ subscriptionStatus: 'expired', updatedAt: now.toISOString() })
            .eq('id', sub.id)

          await supabase
            .from('advertisements_v2')
            .update({
              adStatus: 'ended',
              // 잔재 데이터 클린업 (pending_payment/pending_next_cycle 중 종료, 수정 거절 중 종료 등)
              apartmentChangeStatus: null,
              pendingChanges: null,
              modificationStatus: null,
              modificationRejectedReason: null,
            })
            .eq('id', sub.advertisementId)

          console.log(`[charge-billing] cancel_pending 만료 처리 - subscriptionId: ${sub.id}`)

          // 광고 중단 완료 FCM 알림 (non-critical)
          try {
            const partnerId = (sub as any).advertisements_v2?.partnerId
            if (partnerId) {
              await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  partnerUserId: partnerId,
                  title: '광고 중단 완료',
                  body: '광고가 중단되었습니다.',
                  type: 'ad_ended',
                  navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } },
                }),
              })
            }
          } catch (notiErr) {
            console.error(`[charge-billing] cancel_pending 만료 알림 실패 (non-critical): ${notiErr}`)
          }
        } catch (cancelErr) {
          console.error(`[charge-billing] cancel_pending 만료 처리 실패 - subscriptionId: ${sub.id}`, cancelErr)
        }
      }
    }

    // 1. 결제 대상 구독 조회
    //    - active: freeEndDate 도래 또는 nextBillingDate 도래
    //    - grace_period: nextBillingDate 도래 (재시도)
    const { data: subscriptions, error: subQueryError } = await supabase
      .from('ad_subscriptions_v2')
      .select(
        'id, "advertisementId", "billingKeyId", "subscriptionStatus", '
        + '"monthlyAmount", "nextBillingDate", "freeEndDate", "graceEndDate", "retryCount", "billingAnchorDay", '
        + 'advertisements_v2!inner("partnerId")',
      )
      .in('subscriptionStatus', ['active', 'grace_period'])
      .lte('nextBillingDate', endOfToday.toISOString())

    if (subQueryError) {
      throw new Error(`구독 조회 실패: ${subQueryError.message}`)
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[charge-billing] 결제 대상 구독 없음')
      return new Response(
        JSON.stringify({ success: true, charged: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`[charge-billing] 결제 대상 구독 수: ${subscriptions.length}`)

    const tossAuthHeader = 'Basic ' + btoa(TOSS_BILLING_SECRET_KEY + ':')
    let chargedCount = 0
    let failedCount = 0

    for (const sub of subscriptions) {
      try {
        // graceEndDate 초과 시 expired 처리
        if (sub.graceEndDate && new Date(sub.graceEndDate) < now) {
          await supabase
            .from('ad_subscriptions_v2')
            .update({ subscriptionStatus: 'expired', updatedAt: now.toISOString() })
            .eq('id', sub.id)

          await supabase
            .from('advertisements_v2')
            .update({
              adStatus: 'ended',
              // 잔재 데이터 클린업
              apartmentChangeStatus: null,
              pendingChanges: null,
              modificationStatus: null,
              modificationRejectedReason: null,
            })
            .eq('id', sub.advertisementId)

          console.log(`[charge-billing] grace period 만료 - subscriptionId: ${sub.id}`)

          // 광고 중단 FCM 알림 (non-critical)
          try {
            const partnerId = (sub as any).advertisements_v2?.partnerId
            if (partnerId) {
              await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  partnerUserId: partnerId,
                  title: '광고가 중단되었습니다',
                  body: '결제 기간이 초과되어 광고가 중단되었습니다.',
                  type: 'ad_ended',
                  navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } },
                }),
              })
            }
          } catch (notiErr) {
            console.error(`[charge-billing] grace period 만료 알림 실패 (non-critical): ${notiErr}`)
          }

          continue
        }

        // 2. 중복 결제 방지: 당월 성공 이력 확인
        const periodStart = new Date(sub.nextBillingDate ?? sub.freeEndDate)
        const { count: alreadyPaid } = await supabase
          .from('ad_payment_history_v2')
          .select('id', { count: 'exact', head: true })
          .eq('subscriptionId', sub.id)
          .eq('status', 'success')
          .gte('billingPeriodStart', periodStart.toISOString())

        if ((alreadyPaid ?? 0) > 0) {
          console.log(`[charge-billing] 중복 결제 skip - subscriptionId: ${sub.id}`)
          continue
        }

        // 2.5 0원 구독: Toss 스킵, success 이력 직접 기록
        if (sub.monthlyAmount === 0) {
          const zeroAnchorDay: number = sub.billingAnchorDay ?? periodStart.getUTCDate()
          const zeroPeriodEnd = addOneMonth(periodStart, zeroAnchorDay)
          await Promise.all([
            supabase.from('ad_payment_history_v2').insert({
              subscriptionId: sub.id,
              billingKeyId: sub.billingKeyId,
              amount: 0, supplyAmount: 0, vatAmount: 0,
              status: 'success',
              paymentDate: now.toISOString(),
              billingPeriodStart: periodStart.toISOString(),
              billingPeriodEnd: zeroPeriodEnd.toISOString(),
            }),
            supabase.from('ad_subscriptions_v2').update({
              subscriptionStatus: 'active',
              nextBillingDate: zeroPeriodEnd.toISOString(),
              graceEndDate: null,
              retryCount: 0,
              updatedAt: now.toISOString(),
            }).eq('id', sub.id),
          ])
          chargedCount++
          console.log(`[charge-billing] 0원 구독 갱신 - subscriptionId: ${sub.id}`)

          try {
            const partnerId = (sub as any).advertisements_v2?.partnerId
            if (partnerId) {
              const kstNext = new Date(zeroPeriodEnd.getTime() + 9 * 60 * 60 * 1000)
              const nextDateStr = `${kstNext.getUTCMonth() + 1}월 ${kstNext.getUTCDate()}일`
              await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  partnerUserId: partnerId,
                  title: '광고 정기결제 완료',
                  body: `0원이 결제되었습니다. 다음 결제일은 ${nextDateStr}입니다.`,
                  type: 'billing_success',
                  navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } },
                }),
              })
            }
          } catch (notiErr) {
            console.error(`[charge-billing] 0원 구독 갱신 알림 실패 (non-critical): ${notiErr}`)
          }

          continue
        }

        // 3. 빌링키 조회 (isActive 체크 포함)
        const { data: billingKeyRow } = await supabase
          .from('ad_billing_keys_v2')
          .select('"customerKey", "isActive"')
          .eq('id', sub.billingKeyId)
          .single()

        // 빌링키 없거나 비활성화된 경우 → grace_period 전환 (결제 실패와 동일 처리)
        if (!billingKeyRow || !billingKeyRow.isActive) {
          const noKeyRetryCount = (sub.retryCount ?? 0) + 1
          const noKeyGraceEnd = new Date(now)
          noKeyGraceEnd.setDate(noKeyGraceEnd.getDate() + GRACE_PERIOD_DAYS)
          const noKeyAnchorDay: number = sub.billingAnchorDay ?? new Date(sub.nextBillingDate ?? sub.freeEndDate).getUTCDate()
          const pStart = new Date(sub.nextBillingDate ?? sub.freeEndDate)
          const pEnd = addOneMonth(pStart, noKeyAnchorDay)

          await Promise.all([
            supabase.from('ad_payment_history_v2').insert({
              subscriptionId: sub.id,
              billingKeyId: sub.billingKeyId,
              supplyAmount: 0,
              vatAmount: 0,
              amount: sub.monthlyAmount,
              paymentDate: now.toISOString(),
              billingPeriodStart: pStart.toISOString(),
              billingPeriodEnd: pEnd.toISOString(),
              status: 'failed',
              failReason: '등록된 카드가 없거나 비활성화되었습니다.',
            }),
            supabase
              .from('ad_subscriptions_v2')
              .update({
                subscriptionStatus: 'grace_period',
                graceEndDate: sub.graceEndDate ?? noKeyGraceEnd.toISOString(),
                retryCount: noKeyRetryCount,
                lastRetryAt: now.toISOString(),
                updatedAt: now.toISOString(),
              })
              .eq('id', sub.id),
          ])

          failedCount++
          console.log(`[charge-billing] 빌링키 없음/비활성 → grace_period 전환 - subscriptionId: ${sub.id}`)

          // FCM 알림 (non-critical)
          try {
            const partnerId = (sub as any).advertisements_v2?.partnerId
            if (partnerId) {
              await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  partnerUserId: partnerId,
                  title: '광고 결제 실패',
                  body: '등록된 카드가 없거나 비활성화되었습니다. 앱에서 카드를 다시 등록해주세요.',
                  type: 'billing_failed',
                  navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } },
                }),
              })
            }
          } catch (notiErr) {
            console.error(`[charge-billing] 빌링키 없음 알림 실패 (non-critical): ${notiErr}`)
          }

          continue
        }

        const customerKey = billingKeyRow.customerKey

        // 3b. 빌링키 복호화 (DB 함수 사용)
        const { data: decryptedKey, error: decryptError } = await supabase.rpc(
          'decrypt_billing_key',
          {
            p_billing_key_id: sub.billingKeyId,
            p_billing_key_secret: BILLING_KEY_SECRET,
          },
        )

        if (decryptError || !decryptedKey) {
          throw new Error(`빌링키 복호화 실패: ${decryptError?.message}`)
        }

        // 4. 토스페이먼츠 결제 승인 API 호출
        const anchorDay: number = sub.billingAnchorDay ?? periodStart.getUTCDate()
        const periodEnd = addOneMonth(periodStart, anchorDay)

        const orderId = `AD-${sub.id}-${Date.now()}`
        const orderName = '울단지 광고 정기결제'

        const tossRes = await fetch(
          `https://api.tosspayments.com/v1/billing/${decryptedKey}`,
          {
            method: 'POST',
            headers: {
              Authorization: tossAuthHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              customerKey,
              amount: sub.monthlyAmount,
              orderId,
              orderName,
            }),
          },
        )

        const tossData = await tossRes.json()

        if (tossRes.ok) {
          // 4a. 결제 성공 처리
          const nextBillingDate = addOneMonth(periodStart, anchorDay)

          const vatAmount = Math.round(sub.monthlyAmount / 11)
          const supplyAmount = sub.monthlyAmount - vatAmount

          await Promise.all([
            // 결제 이력 INSERT
            supabase.from('ad_payment_history_v2').insert({
              subscriptionId: sub.id,
              billingKeyId: sub.billingKeyId,
              supplyAmount,
              vatAmount,
              amount: sub.monthlyAmount,
              paymentDate: now.toISOString(),
              billingPeriodStart: periodStart.toISOString(),
              billingPeriodEnd: periodEnd.toISOString(),
              status: 'success',
              paymentKey: tossData.paymentKey ?? null,
              receiptUrl: tossData.receipt?.url ?? null,
            }),
            // 구독 nextBillingDate 갱신
            supabase
              .from('ad_subscriptions_v2')
              .update({
                subscriptionStatus: 'active',
                nextBillingDate: nextBillingDate.toISOString(),
                graceEndDate: null,
                retryCount: 0,
                updatedAt: now.toISOString(),
              })
              .eq('id', sub.id),
          ])

          chargedCount++
          console.log(`[charge-billing] 결제 성공 - subscriptionId: ${sub.id}`)

          // 결제 성공 FCM 알림 (non-critical)
          try {
            const partnerId = (sub as any).advertisements_v2?.partnerId
            if (partnerId) {
              const kstNext = new Date(nextBillingDate.getTime() + 9 * 60 * 60 * 1000)
              const nextDateStr = `${kstNext.getUTCMonth() + 1}월 ${kstNext.getUTCDate()}일`
              const amountStr = sub.monthlyAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  partnerUserId: partnerId,
                  title: '광고 정기결제 완료',
                  body: `${amountStr}원이 결제되었습니다. 다음 결제일은 ${nextDateStr}입니다.`,
                  type: 'billing_success',
                  navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } },
                }),
              })
            }
          } catch (notiErr) {
            console.error(`[charge-billing] 결제 성공 알림 실패 (non-critical): ${notiErr}`)
          }

          // Plan SC: 결제 성공 후 아파트 변경 처리
          try {
            const { data: adRow } = await supabase
              .from('advertisements_v2')
              .select('"apartmentChangeStatus", "pendingChanges", "approvedDiscountRate"')
              .eq('id', sub.advertisementId)
              .single()

            // pending_payment 만료 처리: 차액 미결제 상태에서 정기결제일 도달
            // → 기존 아파트 유지, 기존 요금으로 결제(이미 위에서 처리됨), pending 상태 전체 초기화
            if (adRow?.apartmentChangeStatus === 'pending_payment') {
              await supabase
                .from('advertisements_v2')
                .update({
                  apartmentChangeStatus: null,
                  pendingChanges: null,
                  modificationStatus: null,
                  modificationRejectedReason: null,
                })
                .eq('id', sub.advertisementId)

              console.log(
                `[charge-billing] pending_payment 만료 초기화 - adId: ${sub.advertisementId} (아파트 변경 미적용, 기존 요금 청구됨)`,
              )
            }

            // 케이스 4: 금액 감소 + 결제이력 → 다음달 정기결제일에 자동 적용
            if (adRow?.apartmentChangeStatus === 'pending_next_cycle') {
              const pendingChanges = adRow.pendingChanges ?? {}
              const pendingApartments: { apartmentId: string; totalHouseholds: number }[] =
                pendingChanges.apartments ?? []

              if (pendingApartments.length > 0) {
                // 아파트 교체 (기존 삭제 → 신규 insert)
                // monthlyAmount는 approve-modification 케이스 4 승인 시 이미 갱신됨
                await supabase
                  .from('advertisement_apartments_v2')
                  .delete()
                  .eq('advertisementId', sub.advertisementId)

                await supabase
                  .from('advertisement_apartments_v2')
                  .insert(
                    pendingApartments.map((a) => ({
                      advertisementId: sub.advertisementId,
                      apartmentId: a.apartmentId,
                      totalHouseholds: a.totalHouseholds,
                    })),
                  )

                // 텍스트 변경 및 서브카테고리 추출 (케이스 4: 승인 시 보존된 pendingChanges에서 일괄 적용)
                const { apartments: _apts, subCategoryIds, ...adTextChanges } = pendingChanges

                // 텍스트 변경 + apartmentChangeStatus 초기화 + approvedMonthlyAmount 갱신
                await supabase
                  .from('advertisements_v2')
                  .update({
                    ...adTextChanges,
                    apartmentChangeStatus: null,
                    pendingChanges: null,
                    approvedMonthlyAmount: sub.monthlyAmount,
                  })
                  .eq('id', sub.advertisementId)

                // 서브카테고리 junction table 갱신
                if (Array.isArray(subCategoryIds)) {
                  await supabase
                    .from('advertisement_sub_categories_v2')
                    .delete()
                    .eq('advertisementId', sub.advertisementId)

                  if (subCategoryIds.length > 0) {
                    await supabase
                      .from('advertisement_sub_categories_v2')
                      .insert(
                        subCategoryIds.map((subId: string) => ({
                          advertisementId: sub.advertisementId,
                          subCategoryId: subId,
                        })),
                      )
                  }
                }

                console.log(
                  `[charge-billing] pending_next_cycle 일괄 적용 완료 - adId: ${sub.advertisementId}, monthlyAmount: ${sub.monthlyAmount}`,
                )
              }
            }
          } catch (aptErr) {
            // best-effort: 결제는 이미 성공, 아파트 교체만 실패한 경우 로그만 기록
            console.error(
              `[charge-billing] pending_next_cycle 처리 실패 (non-critical) - adId: ${sub.advertisementId}`,
              aptErr,
            )
          }
        } else {
          // 4b. 결제 실패 처리
          const retryCount = (sub.retryCount ?? 0) + 1
          const graceEndDate = new Date(now)
          graceEndDate.setDate(graceEndDate.getDate() + GRACE_PERIOD_DAYS)

          await Promise.all([
            // 실패 이력 INSERT
            supabase.from('ad_payment_history_v2').insert({
              subscriptionId: sub.id,
              billingKeyId: sub.billingKeyId,
              supplyAmount: 0,
              vatAmount: 0,
              amount: sub.monthlyAmount,
              paymentDate: now.toISOString(),
              billingPeriodStart: periodStart.toISOString(),
              billingPeriodEnd: periodEnd.toISOString(),
              status: 'failed',
              failReason: tossData.message ?? '결제 실패',
            }),
            // grace_period 전환
            // graceEndDate는 최초 실패 시점 기준으로 고정 (재시도 실패 시 갱신하지 않음)
            // 갱신하면 매 실패마다 D+3씩 연장되어 광고가 절대 만료되지 않는 버그 발생
            supabase
              .from('ad_subscriptions_v2')
              .update({
                subscriptionStatus: 'grace_period',
                graceEndDate: sub.graceEndDate ?? graceEndDate.toISOString(),
                retryCount,
                lastRetryAt: now.toISOString(),
                updatedAt: now.toISOString(),
              })
              .eq('id', sub.id),
          ])

          failedCount++

          // 결제 실패 FCM 알림 (non-critical)
          try {
            const partnerId = (sub as any).advertisements_v2?.partnerId
            if (partnerId) {
              const failMessage = getBillingFailMessage(tossData.code ?? '')
              await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  partnerUserId: partnerId,
                  title: '광고 결제 실패',
                  body: failMessage,
                  type: 'billing_failed',
                  navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } },
                }),
              })
            }
          } catch (notiErr) {
            console.error(`[charge-billing] 결제 실패 알림 실패 (non-critical): ${notiErr}`)
          }

          console.log(
            `[charge-billing] 결제 실패 - subscriptionId: ${sub.id}, reason: ${tossData.message}`,
          )
        }
      } catch (subError) {
        failedCount++
        console.error(`[charge-billing] 구독 처리 오류 - subscriptionId: ${sub.id}`, subError)
      }
    }

    console.log(`[charge-billing] 완료 - 성공: ${chargedCount}, 실패: ${failedCount}`)

    return new Response(
      JSON.stringify({ success: true, charged: chargedCount, failed: failedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[charge-billing] 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
