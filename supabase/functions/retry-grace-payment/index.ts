import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const TOSS_BILLING_SECRET_KEY = Deno.env.get('TOSS_BILLING_SECRET_KEY')!
    const BILLING_KEY_SECRET = Deno.env.get('BILLING_KEY_SECRET')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

    if (!TOSS_BILLING_SECRET_KEY || !BILLING_KEY_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
      throw new Error('필수 환경 변수가 설정되지 않았습니다.')
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 정보가 없습니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { advertisementId } = await req.json()
    if (!advertisementId) {
      return new Response(
        JSON.stringify({ error: 'advertisementId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증입니다.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: partnerData, error: partnerError } = await supabase
      .from('partner_users')
      .select('id')
      .eq('userId', user.id)
      .single()

    if (partnerError || !partnerData) {
      return new Response(
        JSON.stringify({ error: '파트너 정보를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const partnerId = partnerData.id as string

    const { data: sub, error: subError } = await supabase
      .from('ad_subscriptions_v2')
      .select(
        'id, "billingKeyId", "monthlyAmount", "billingAnchorDay", "graceEndDate", ' +
        'advertisements_v2!inner("partnerId")',
      )
      .eq('advertisementId', advertisementId)
      .eq('subscriptionStatus', 'grace_period')
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subError) {
      throw new Error(`구독 조회 실패: ${subError.message}`)
    }

    if (!sub) {
      return new Response(
        JSON.stringify({ error: '결제 대기 중인 구독이 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if ((sub as any).advertisements_v2?.partnerId !== partnerId) {
      return new Response(
        JSON.stringify({ error: '본인의 광고만 결제할 수 있습니다.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (sub.graceEndDate && new Date(sub.graceEndDate) < new Date()) {
      return new Response(
        JSON.stringify({ error: '유예기간이 종료되었습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: billingKeyRow, error: billingKeyError } = await supabase
      .from('ad_billing_keys_v2')
      .select('"customerKey", "isActive"')
      .eq('id', sub.billingKeyId)
      .single()

    if (billingKeyError || !billingKeyRow) {
      return new Response(
        JSON.stringify({ error: '빌링키를 찾을 수 없습니다.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!billingKeyRow.isActive || !billingKeyRow.customerKey) {
      return new Response(
        JSON.stringify({ error: '카드 정보가 유효하지 않습니다. 카드를 다시 등록해주세요.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: decryptedKey, error: decryptError } = await supabase.rpc(
      'decrypt_billing_key',
      { p_billing_key_id: sub.billingKeyId, p_billing_key_secret: BILLING_KEY_SECRET },
    )

    if (decryptError || !decryptedKey) {
      throw new Error(`빌링키 복호화 실패: ${decryptError?.message}`)
    }

    const now = new Date()
    const orderId = `RETRY-${(sub.id as string).replace(/-/g, '').slice(0, 8)}-${Date.now()}`
    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/billing/${decryptedKey}`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(TOSS_BILLING_SECRET_KEY + ':'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: billingKeyRow.customerKey,
          amount: sub.monthlyAmount,
          orderId,
          orderName: '울단지 광고 정기결제',
        }),
      },
    )

    const tossData = await tossRes.json()

    if (!tossRes.ok) {
      console.error('[retry-grace-payment] 토스 결제 실패:', tossData)
      return new Response(
        JSON.stringify({ error: tossData.message ?? '결제에 실패했습니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const anchorDay: number = sub.billingAnchorDay ?? now.getDate()
    const nextBillingDate = addOneMonth(now, anchorDay)
    const vatAmount = Math.round(sub.monthlyAmount / 11)
    const supplyAmount = sub.monthlyAmount - vatAmount

    await Promise.all([
      supabase.from('ad_payment_history_v2').insert({
        subscriptionId: sub.id,
        billingKeyId: sub.billingKeyId,
        amount: sub.monthlyAmount,
        supplyAmount,
        vatAmount,
        status: 'success',
        paymentDate: now.toISOString(),
        billingPeriodStart: now.toISOString(),
        billingPeriodEnd: nextBillingDate.toISOString(),
        paymentKey: tossData.paymentKey ?? null,
        receiptUrl: tossData.receipt?.url ?? null,
      }),
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

    try {
      const amountStr = (sub.monthlyAmount as number).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      const nextKst = new Date(nextBillingDate.getTime() + 9 * 60 * 60 * 1000)
      const nextDateStr = `${nextKst.getUTCMonth() + 1}월 ${nextKst.getUTCDate()}일`
      await fetch(`${SUPABASE_URL}/functions/v1/send-partner-fcm-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerUserId: partnerId,
          title: '광고 결제 완료',
          body: `${amountStr}원이 결제되었습니다. 다음 결제일은 ${nextDateStr}입니다.`,
          type: 'billing_success',
          navigationData: { type: 'ad_detail', params: { advertisementId } },
        }),
      })
    } catch (fcmError) {
      console.error('[retry-grace-payment] FCM 알림 전송 실패 (non-critical):', fcmError)
    }

    console.log(`[retry-grace-payment] 결제 성공 - subscriptionId: ${sub.id}, amount: ${sub.monthlyAmount}`)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[retry-grace-payment] 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
