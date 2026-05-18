import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GRACE_PERIOD_DAYS = 3

function getBillingFailMessage(errorCode: string): string {
  switch (errorCode) {
    case 'REJECT_CARD_PAYMENT': return '한도초과 또는 잔액부족으로 결제에 실패했습니다.'
    case 'REJECT_ACCOUNT_PAYMENT': return '잔액부족으로 결제에 실패했습니다.'
    case 'INVALID_STOPPED_CARD': return '정지된 카드로 결제에 실패했습니다. 앱에서 카드를 다시 등록해주세요.'
    case 'INVALID_CARD_EXPIRATION': return '카드 유효기간이 만료되었습니다. 앱에서 카드를 다시 등록해주세요.'
    case 'INVALID_CARD_NUMBER':
    case 'INVALID_BILL_KEY_REQUEST': return '카드 정보가 유효하지 않습니다. 앱에서 카드를 다시 등록해주세요.'
    case 'NOT_SUPPORTED_CARD_TYPE': return '지원되지 않는 카드 종류입니다. 다른 카드로 등록해주세요.'
    case 'NOT_REGISTERED_CARD_COMPANY': return '카드 등록이 필요합니다. 앱에서 카드를 다시 등록해주세요.'
    case 'INVALID_REJECT_CARD': return '카드 사용이 거절되었습니다. 카드사에 문의해주세요.'
    case 'REJECT_CARD_COMPANY': return '카드사에서 결제를 거절했습니다. 카드사에 문의해주세요.'
    case 'EXCEED_MAX_AUTH_COUNT': return '카드 인증 횟수를 초과했습니다. 카드사에 문의해주세요.'
    case 'FAILED_CARD_COMPANY_RESPONSE':
    case 'FAILED_INTERNAL_SYSTEM_PROCESSING':
    case 'FAILED_DB_PROCESSING':
    case 'COMMON_ERROR': return '일시적인 오류로 결제에 실패했습니다. 잠시 후 자동으로 재시독됩니다.'
    default: return '정기결제에 실패했습니다. 앱에서 카드 정보를 확인해주세요.'
  }
}

function addOneMonth(date: Date, anchorDay: number): Date {
  const result = new Date(date)
  result.setDate(1)
  result.setMonth(result.getMonth() + 1)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(anchorDay, lastDay))
  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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
    const endOfToday = new Date(now)
    endOfToday.setUTCHours(23, 59, 59, 999)

    // 0. cancel_pending 만료 처리
    {
      const { data: cancelledSubs } = await supabase
        .from('ad_subscriptions_v2').select('id, "advertisementId"')
        .eq('subscriptionStatus', 'cancel_pending').lte('cancelEffectiveAt', endOfToday.toISOString())

      for (const sub of cancelledSubs ?? []) {
        try {
          await supabase.from('ad_subscriptions_v2').update({ subscriptionStatus: 'expired', updatedAt: now.toISOString() }).eq('id', sub.id)
          await supabase.from('advertisements_v2').update({ adStatus: 'ended', apartmentChangeStatus: null, pendingChanges: null, modificationStatus: null, modificationRejectedReason: null }).eq('id', sub.advertisementId)
          console.log(`[charge-billing] cancel_pending 만료 - subscriptionId: ${sub.id}`)
        } catch (e) { console.error(`[charge-billing] cancel_pending 만료 실패: ${sub.id}`, e) }
      }
    }

    // 1. 결제 대상 구독 조회
    const { data: subscriptions, error: subQueryError } = await supabase
      .from('ad_subscriptions_v2')
      .select('id, "advertisementId", "billingKeyId", "subscriptionStatus", "monthlyAmount", "nextBillingDate", "freeEndDate", "graceEndDate", "retryCount", "billingAnchorDay", advertisements_v2!inner("partnerId")')
      .in('subscriptionStatus', ['active', 'grace_period'])
      .lte('nextBillingDate', endOfToday.toISOString())

    if (subQueryError) throw new Error(`구독 조회 실패: ${subQueryError.message}`)
    if (!subscriptions || subscriptions.length === 0) {
      console.log('[charge-billing] 결제 대상 구독 없음')
      return new Response(JSON.stringify({ success: true, charged: 0 }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[charge-billing] 결제 대상: ${subscriptions.length}`)
    const tossAuthHeader = 'Basic ' + btoa(TOSS_BILLING_SECRET_KEY + ':')
    let chargedCount = 0, failedCount = 0

    for (const sub of subscriptions) {
      try {
        if (sub.graceEndDate && new Date(sub.graceEndDate) < now) {
          await supabase.from('ad_subscriptions_v2').update({ subscriptionStatus: 'expired', updatedAt: now.toISOString() }).eq('id', sub.id)
          await supabase.from('advertisements_v2').update({ adStatus: 'ended', apartmentChangeStatus: null, pendingChanges: null, modificationStatus: null, modificationRejectedReason: null }).eq('id', sub.advertisementId)
          console.log(`[charge-billing] grace period 만료 - subscriptionId: ${sub.id}`)
          continue
        }

        // 2. 중복 결제 방지: success 이력 확인
        const periodStart = new Date(sub.nextBillingDate ?? sub.freeEndDate)
        const { count: alreadyPaid } = await supabase
          .from('ad_payment_history_v2').select('id', { count: 'exact', head: true })
          .eq('subscriptionId', sub.id).eq('status', 'success')
          .gte('billingPeriodStart', periodStart.toISOString())

        if ((alreadyPaid ?? 0) > 0) {
          console.log(`[charge-billing] 중복 skip - subscriptionId: ${sub.id}`)
          continue
        }

        const anchorDay: number = sub.billingAnchorDay ?? periodStart.getUTCDate()
        const periodEnd = addOneMonth(periodStart, anchorDay)
        const nextBillingDate = addOneMonth(periodStart, anchorDay)

        // 3. 0원 구독: 토스 스킵, success 0원 이력
        if (sub.monthlyAmount === 0) {
          await Promise.all([
            supabase.from('ad_payment_history_v2').insert({
              subscriptionId: sub.id, billingKeyId: sub.billingKeyId,
              amount: 0, supplyAmount: 0, vatAmount: 0, status: 'success',
              paymentDate: now.toISOString(),
              billingPeriodStart: periodStart.toISOString(), billingPeriodEnd: periodEnd.toISOString(),
            }),
            supabase.from('ad_subscriptions_v2').update({ subscriptionStatus: 'active', nextBillingDate: nextBillingDate.toISOString(), graceEndDate: null, retryCount: 0, updatedAt: now.toISOString() }).eq('id', sub.id),
          ])
          chargedCount++
          console.log(`[charge-billing] 0원 갱신 - subscriptionId: ${sub.id}`)
          continue
        }

        // 4. 빌링키 확인
        const { data: billingKeyRow } = await supabase.from('ad_billing_keys_v2').select('"customerKey", "isActive"').eq('id', sub.billingKeyId).single()

        if (!billingKeyRow || !billingKeyRow.isActive) {
          const retryCount = (sub.retryCount ?? 0) + 1
          const graceEnd = new Date(now); graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS)
          await Promise.all([
            supabase.from('ad_payment_history_v2').insert({ subscriptionId: sub.id, billingKeyId: sub.billingKeyId, supplyAmount: 0, vatAmount: 0, amount: sub.monthlyAmount, paymentDate: now.toISOString(), billingPeriodStart: periodStart.toISOString(), billingPeriodEnd: periodEnd.toISOString(), status: 'failed', failReason: '등록된 카드가 없거나 비활성화되었습니다.' }),
            supabase.from('ad_subscriptions_v2').update({ subscriptionStatus: 'grace_period', graceEndDate: sub.graceEndDate ?? graceEnd.toISOString(), retryCount, lastRetryAt: now.toISOString(), updatedAt: now.toISOString() }).eq('id', sub.id),
          ])
          failedCount++
          try {
            const pid = (sub as any).advertisements_v2?.partnerId
            if (pid) await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, { method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ partnerUserId: pid, title: '광고 결제 실패', body: '등록된 카드가 없거나 비활성화되었습니다.', type: 'billing_failed', navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } } }) })
          } catch (e) { console.error(`[charge-billing] 빌링키 없음 알림 실패: ${e}`) }
          continue
        }

        const { data: decryptedKey, error: decryptError } = await supabase.rpc('decrypt_billing_key', { p_billing_key_id: sub.billingKeyId, p_billing_key_secret: BILLING_KEY_SECRET })
        if (decryptError || !decryptedKey) throw new Error(`빌링키 복호화 실패: ${decryptError?.message}`)

        const tossRes = await fetch(`https://api.tosspayments.com/v1/billing/${decryptedKey}`, {
          method: 'POST',
          headers: { Authorization: tossAuthHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerKey: billingKeyRow.customerKey, amount: sub.monthlyAmount, orderId: `AD-${sub.id}-${Date.now()}`, orderName: '울단지 광고 정기결제' }),
        })
        const tossData = await tossRes.json()

        if (tossRes.ok) {
          const vatAmount = Math.round(sub.monthlyAmount / 11)
          await Promise.all([
            supabase.from('ad_payment_history_v2').insert({ subscriptionId: sub.id, billingKeyId: sub.billingKeyId, supplyAmount: sub.monthlyAmount - vatAmount, vatAmount, amount: sub.monthlyAmount, paymentDate: now.toISOString(), billingPeriodStart: periodStart.toISOString(), billingPeriodEnd: periodEnd.toISOString(), status: 'success', paymentKey: tossData.paymentKey ?? null, receiptUrl: tossData.receipt?.url ?? null }),
            supabase.from('ad_subscriptions_v2').update({ subscriptionStatus: 'active', nextBillingDate: nextBillingDate.toISOString(), graceEndDate: null, retryCount: 0, updatedAt: now.toISOString() }).eq('id', sub.id),
          ])
          chargedCount++
          console.log(`[charge-billing] 결제 성공 - subscriptionId: ${sub.id}`)

          try {
            const pid = (sub as any).advertisements_v2?.partnerId
            if (pid) {
              const kst = new Date(nextBillingDate.getTime() + 9 * 60 * 60 * 1000)
              const amt = sub.monthlyAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, { method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ partnerUserId: pid, title: '광고 정기결제 완료', body: `${amt}원이 결제되었습니다. 다음 결제일은 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일입니다.`, type: 'billing_success', navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } } }) })
            }
          } catch (e) { console.error(`[charge-billing] 결제 성공 알림 실패: ${e}`) }

          try {
            const { data: adRow } = await supabase.from('advertisements_v2').select('"apartmentChangeStatus", "pendingChanges"').eq('id', sub.advertisementId).single()
            if (adRow?.apartmentChangeStatus === 'pending_payment') {
              await supabase.from('advertisements_v2').update({ apartmentChangeStatus: null, pendingChanges: null, modificationStatus: null, modificationRejectedReason: null }).eq('id', sub.advertisementId)
            }
            if (adRow?.apartmentChangeStatus === 'pending_next_cycle') {
              const pending = adRow.pendingChanges ?? {}
              const apts: { apartmentId: string; totalHouseholds: number }[] = pending.apartments ?? []
              if (apts.length > 0) {
                await supabase.from('advertisement_apartments_v2').delete().eq('advertisementId', sub.advertisementId)
                await supabase.from('advertisement_apartments_v2').insert(apts.map((a) => ({ advertisementId: sub.advertisementId, apartmentId: a.apartmentId, totalHouseholds: a.totalHouseholds })))
                const { apartments: _a, subCategoryIds, ...textChanges } = pending
                await supabase.from('advertisements_v2').update({ ...textChanges, apartmentChangeStatus: null, pendingChanges: null, approvedMonthlyAmount: sub.monthlyAmount }).eq('id', sub.advertisementId)
                if (Array.isArray(subCategoryIds)) {
                  await supabase.from('advertisement_sub_categories_v2').delete().eq('advertisementId', sub.advertisementId)
                  if (subCategoryIds.length > 0) await supabase.from('advertisement_sub_categories_v2').insert(subCategoryIds.map((id: string) => ({ advertisementId: sub.advertisementId, subCategoryId: id })))
                }
              }
            }
          } catch (e) { console.error(`[charge-billing] 아파트 변경 실패: ${e}`) }
        } else {
          const retryCount = (sub.retryCount ?? 0) + 1
          const graceEnd = new Date(now); graceEnd.setDate(graceEnd.getDate() + GRACE_PERIOD_DAYS)
          await Promise.all([
            supabase.from('ad_payment_history_v2').insert({ subscriptionId: sub.id, billingKeyId: sub.billingKeyId, supplyAmount: 0, vatAmount: 0, amount: sub.monthlyAmount, paymentDate: now.toISOString(), billingPeriodStart: periodStart.toISOString(), billingPeriodEnd: periodEnd.toISOString(), status: 'failed', failReason: tossData.message ?? '결제 실패' }),
            supabase.from('ad_subscriptions_v2').update({ subscriptionStatus: 'grace_period', graceEndDate: sub.graceEndDate ?? graceEnd.toISOString(), retryCount, lastRetryAt: now.toISOString(), updatedAt: now.toISOString() }).eq('id', sub.id),
          ])
          failedCount++
          try {
            const pid = (sub as any).advertisements_v2?.partnerId
            if (pid) await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, { method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ partnerUserId: pid, title: '광고 결제 실패', body: getBillingFailMessage(tossData.code ?? ''), type: 'billing_failed', navigationData: { type: 'ad_detail', params: { advertisementId: sub.advertisementId } } }) })
          } catch (e) { console.error(`[charge-billing] 결제 실패 알림 실패: ${e}`) }
          console.log(`[charge-billing] 결제 실패 - subscriptionId: ${sub.id}, reason: ${tossData.message}`)
        }
      } catch (e) {
        failedCount++
        console.error(`[charge-billing] 구독 처리 오류 - subscriptionId: ${sub.id}`, e)
      }
    }

    console.log(`[charge-billing] 완료 - 성공: ${chargedCount}, 실패: ${failedCount}`)
    return new Response(JSON.stringify({ success: true, charged: chargedCount, failed: failedCount }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[charge-billing] 오류:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
