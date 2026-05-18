import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 테스트 결제 금액 (최소 결제 금액)
const TEST_AMOUNT = 100

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

    const { billingKeyId } = await req.json()

    if (!billingKeyId) {
      return new Response(
        JSON.stringify({ error: 'billingKeyId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. 빌링키 복호화 (DB 함수 사용)
    const { data: decryptedKey, error: decryptError } = await supabase.rpc(
      'decrypt_billing_key',
      {
        p_billing_key_id: billingKeyId,
        p_billing_key_secret: BILLING_KEY_SECRET,
      },
    )

    if (decryptError || !decryptedKey) {
      throw new Error(`빌링키 복호화 실패: ${decryptError?.message}`)
    }

    // 2. customerKey 조회 (카드 등록 시 저장된 값)
    const { data: billingKeyRow, error: billingKeyError } = await supabase
      .from('ad_billing_keys_v2')
      .select('"customerKey"')
      .eq('id', billingKeyId)
      .single()

    if (billingKeyError || !billingKeyRow) {
      throw new Error(`빌링키 조회 실패: ${billingKeyError?.message}`)
    }

    const customerKey = billingKeyRow.customerKey

    // 3. 토스페이먼츠 테스트 결제 호출 (DB 변경 없음)
    const orderId = `TEST-${billingKeyId}-${Date.now()}`
    const tossAuthHeader = 'Basic ' + btoa(TOSS_BILLING_SECRET_KEY + ':')

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
          amount: TEST_AMOUNT,
          orderId,
          orderName: '[테스트] 울단지 광고 결제',
        }),
      },
    )

    const tossData = await tossRes.json()

    if (tossRes.ok) {
      console.log(`[test-charge] 테스트 결제 성공 - billingKeyId: ${billingKeyId}, paymentKey: ${tossData.paymentKey}`)
      console.log('[test-charge] 토스 응답 전체:', JSON.stringify(tossData))
      return new Response(
        JSON.stringify({ success: true, tossResponse: tossData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    } else {
      console.warn(`[test-charge] 테스트 결제 실패 - billingKeyId: ${billingKeyId}`)
      console.warn('[test-charge] 토스 오류 응답 전체:', JSON.stringify(tossData))
      return new Response(
        JSON.stringify({ success: false, tossResponse: tossData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  } catch (error) {
    console.error('[test-charge] 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
