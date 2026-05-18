import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function addMonths(date: Date, months: number, anchorDay: number): Date {
  const result = new Date(date)
  result.setDate(1)
  result.setMonth(result.getMonth() + months)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(anchorDay, lastDay))
  return result
}

serve(async (req) => {
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

    const { advertisementId, billingKeyId: selectedBillingKeyId } = await req.json()

    if (!advertisementId) {
      return new Response(
        JSON.stringify({ error: 'advertisementId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: ad, error: adError } = await supabase
      .from('advertisements_v2')
      .select('id, "partnerId", "freeMonths", "approvedMonthlyAmount", "approvedDiscountRate"')
      .eq('id', advertisementId)
      .single()

    if (adError || !ad) throw new Error(`광고 조회 실패: ${adError?.message}`)

    const partnerId: string = ad.partnerId

    const { data: partnerData } = await supabase
      .from('partner_users')
      .select('hasHadRunningAd')
      .eq('id', partnerId)
      .single()
    const hasHadRunningAd: boolean = partnerData?.hasHadRunningAd ?? false

    let billingKeyId: string

    if (selectedBillingKeyId) {
      const { data: selectedKey, error: selectedKeyError } = await supabase
        .from('ad_billing_keys_v2')
        .select('id')
        .eq('id', selectedBillingKeyId)
        .eq('partnerId', partnerId)
        .eq('isActive', true)
        .maybeSingle()

      if (selectedKeyError || !selectedKey) {
        return new Response(
          JSON.stringify({ error: '유효하지 않은 카드입니다.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      billingKeyId = selectedKey.id
    } else {
      const { data: latestKey, error: latestKeyError } = await supabase
        .from('ad_billing_keys_v2')
        .select('id')
        .eq('partnerId', partnerId)
        .eq('isActive', true)
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestKeyError) throw new Error(`빌링키 조회 실패: ${latestKeyError.message}`)
      if (!latestKey) {
        return new Response(
          JSON.stringify({ error: '등록된 카드가 없습니다. 카드를 먼저 등록해주세요.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      billingKeyId = latestKey.id
    }

    let monthlyAmount: number = ad.approvedMonthlyAmount ?? 0
    let originalMonthlyAmount: number = monthlyAmount
    const discountRate: number = ad.approvedDiscountRate ?? 0

    if (!ad.approvedMonthlyAmount) {
      const { data: apartments } = await supabase
        .from('advertisement_apartments_v2')
        .select('"totalHouseholds"')
        .eq('advertisementId', advertisementId)

      const totalHouseholds = (apartments ?? []).reduce(
        (sum: number, a: { totalHouseholds: number }) => sum + a.totalHouseholds, 0,
      )

      const { data: pricing } = await supabase
        .from('ad_pricing_v2')
        .select('"pricePerHousehold"')
        .order('effectiveFrom', { ascending: false })
        .limit(1)
        .single()

      const pricePerHousehold = pricing?.pricePerHousehold ?? 70
      originalMonthlyAmount = Math.round((totalHouseholds * pricePerHousehold) / 10) * 10
      monthlyAmount = Math.round((originalMonthlyAmount * (100 - discountRate)) / 10) * 10
    } else {
      originalMonthlyAmount = Math.round((ad.approvedMonthlyAmount * 100) / (100 - discountRate) / 10) * 10
    }

    const now = new Date()
    const totalFreeMonths: number = ad.freeMonths ?? 0
    const anchorDay = now.getDate()
    const noFreeTrial = totalFreeMonths === 0

    console.log(
      `[activate-subscription] 결제 모드 - advertisementId: ${advertisementId}, ` +
      `hasHadRunningAd: ${hasHadRunningAd}, freeMonths: ${totalFreeMonths}, ` +
      `discountRate: ${discountRate}, noFreeTrial: ${noFreeTrial}, monthlyAmount: ${monthlyAmount}`,
    )

    if (noFreeTrial && monthlyAmount > 0) {
      // ── 유료 정기결제: 토스 즉시 결제 ──
      const { data: decryptedKey, error: decryptError } = await supabase.rpc(
        'decrypt_billing_key',
        { p_billing_key_id: billingKeyId, p_billing_key_secret: BILLING_KEY_SECRET },
      )
      if (decryptError || !decryptedKey) throw new Error(`빌링키 복호화 실패: ${decryptError?.message}`)

      const { data: billingKeyRow } = await supabase
        .from('ad_billing_keys_v2').select('"customerKey"').eq('id', billingKeyId).single()

      const tossAuthHeader = 'Basic ' + btoa(TOSS_BILLING_SECRET_KEY + ':')
      const tossRes = await fetch(`https://api.tosspayments.com/v1/billing/${decryptedKey}`, {
        method: 'POST',
        headers: { Authorization: tossAuthHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerKey: billingKeyRow?.customerKey,
          amount: monthlyAmount,
          orderId: `AD-INIT-${advertisementId}-${Date.now()}`,
          orderName: '울단지 광고 정기결제',
        }),
      })
      const tossData = await tossRes.json()

      if (!tossRes.ok) {
        console.error('[activate-subscription] 즉시 결제 실패:', tossData.message)
        return new Response(
          JSON.stringify({ error: tossData.message ?? '결제에 실패했습니다.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const nextBillingDate = addMonths(now, 1, anchorDay)

      const { data: subData, error: subError } = await supabase.from('ad_subscriptions_v2').insert({
        advertisementId, billingKeyId, subscriptionStatus: 'active',
        originalMonthlyAmount, discountRate, monthlyAmount,
        periodStartDate: now.toISOString(), freeEndDate: now.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(), billingAnchorDay: anchorDay,
      }).select('id').single()
      if (subError || !subData) throw new Error(`구독 생성 실패: ${subError?.message}`)

      const vatAmount = Math.round(monthlyAmount / 11)
      try {
        await supabase.from('ad_payment_history_v2').insert({
          subscriptionId: subData.id, billingKeyId,
          amount: monthlyAmount, supplyAmount: monthlyAmount - vatAmount, vatAmount,
          status: 'success',
          paymentDate: now.toISOString(),
          billingPeriodStart: now.toISOString(), billingPeriodEnd: nextBillingDate.toISOString(),
          paymentKey: tossData.paymentKey ?? null, receiptUrl: tossData.receipt?.url ?? null,
        })
      } catch (e) { console.error('[activate-subscription] 결제 이력 저장 실패 (non-critical):', e) }

      console.log(`[activate-subscription] 즉시 결제 성공 - advertisementId: ${advertisementId}, amount: ${monthlyAmount}`)

      try {
        const amountStr = monthlyAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        const nextKst = new Date(nextBillingDate.getTime() + 9 * 60 * 60 * 1000)
        await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerUserId: partnerId, title: '광고 결제 완료',
            body: `${amountStr}원이 결제되었습니다. 다음 결제일은 ${nextKst.getUTCMonth() + 1}월 ${nextKst.getUTCDate()}일입니다.`,
            type: 'billing_success', navigationData: { type: 'ad_detail', params: { advertisementId } },
          }),
        })
      } catch (e) { console.error('[activate-subscription] FCM 실패 (non-critical):', e) }

    } else if (noFreeTrial && monthlyAmount === 0) {
      // ── 100% 할인 0원: 토스 스킵, success 0원으로 이력 ──
      const nextBillingDate = addMonths(now, 1, anchorDay)

      const { data: subData, error: subError } = await supabase.from('ad_subscriptions_v2').insert({
        advertisementId, billingKeyId, subscriptionStatus: 'active',
        originalMonthlyAmount, discountRate, monthlyAmount: 0,
        periodStartDate: now.toISOString(), freeEndDate: now.toISOString(),
        nextBillingDate: nextBillingDate.toISOString(), billingAnchorDay: anchorDay,
      }).select('id').single()
      if (subError || !subData) throw new Error(`구독 생성 실패: ${subError?.message}`)

      try {
        await supabase.from('ad_payment_history_v2').insert({
          subscriptionId: subData.id, billingKeyId,
          amount: 0, supplyAmount: 0, vatAmount: 0,
          status: 'success',
          paymentDate: now.toISOString(),
          billingPeriodStart: now.toISOString(), billingPeriodEnd: nextBillingDate.toISOString(),
        })
        console.log(`[activate-subscription] 0원 success 이력 저장 - subscriptionId: ${subData.id}`)
      } catch (e) { console.error('[activate-subscription] 0원 이력 저장 실패 (non-critical):', e) }

      console.log(`[activate-subscription] 0원 활성화 - advertisementId: ${advertisementId}, discountRate: ${discountRate}%`)

    } else {
      // ── 무료체험 ──
      const freeEndDate = addMonths(now, totalFreeMonths, anchorDay)

      const { data: subData, error: subError } = await supabase.from('ad_subscriptions_v2').insert({
        advertisementId, billingKeyId, subscriptionStatus: 'active',
        originalMonthlyAmount, discountRate, monthlyAmount,
        periodStartDate: now.toISOString(), freeEndDate: freeEndDate.toISOString(),
        nextBillingDate: freeEndDate.toISOString(), billingAnchorDay: anchorDay,
      }).select('id').single()
      if (subError || !subData) throw new Error(`구독 생성 실패: ${subError?.message}`)

      try {
        await supabase.from('ad_payment_history_v2').insert({
          subscriptionId: subData.id, billingKeyId,
          amount: 0, supplyAmount: 0, vatAmount: 0, status: 'freeTrial',
          paymentDate: now.toISOString(),
          billingPeriodStart: now.toISOString(), billingPeriodEnd: freeEndDate.toISOString(),
        })
      } catch (e) { console.error('[activate-subscription] freeTrial 저장 실패 (non-critical):', e) }
    }

    const { error: adUpdateError } = await supabase.from('advertisements_v2')
      .update({ adStatus: 'running', paymentStatus: 'paid', activatedAt: now.toISOString() })
      .eq('id', advertisementId)
    if (adUpdateError) throw new Error(`광고 상태 업데이트 실패: ${adUpdateError.message}`)

    await supabase.from('partner_users').update({ hasHadRunningAd: true }).eq('id', partnerId)

    console.log(`[activate-subscription] 완료 - advertisementId: ${advertisementId}`)
    return new Response(
      JSON.stringify({ success: true, monthlyAmount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[activate-subscription] 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
