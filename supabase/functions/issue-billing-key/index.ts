import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ISSUER_CODE_MAP: Record<string, string> = {
  '3K': '기업BC', '46': '광주', '71': '롯데', '30': '산업', '31': 'BC',
  '32': '국민', '33': '하나', '34': '신한', '35': '우리BC', '36': '신한',
  '37': '현대', '38': '롯데', '39': '씨티', '40': 'NH', '41': '농협',
  '43': '전북', '44': '광주', '45': '수협', '46': '신협', '47': '우리',
  '48': '하나', '51': '삼성', '52': '국민', '54': '우리', '55': '카카오뱅크',
  '56': '케이뱅크', '61': '현대', '71': '우체국', '95': '저축은행',
}

function getBillingKeyErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'INVALID_CARD_NUMBER': return '카드번호를 다시 확인해주세요.'
    case 'INVALID_CARD_PASSWORD': return '카드 비밀번호를 다시 확인해주세요.'
    case 'INVALID_CARD_EXPIRATION': return '카드 유효기간을 다시 확인해주세요.'
    case 'INVALID_CARD_IDENTITY': return '주민번호 또는 사업자번호가 카드 소유주 정보와 일치하지 않습니다.'
    case 'INVALID_STOPPED_CARD': return '정지된 카드입니다. 카드 상태를 확인해주세요.'
    case 'INVALID_REJECT_CARD': return '카드 사용이 거절되었습니다. 카드사에 문의해주세요.'
    case 'NOT_SUPPORTED_CARD_TYPE':
    case 'NOT_SUPPORTED_METHOD': return '지원되지 않는 카드 종류입니다. 다른 카드를 사용해주세요.'
    case 'NOT_REGISTERED_CARD_COMPANY': return '카드 등록이 필요합니다. 카드사에 문의해주세요.'
    case 'EXCEED_MAX_AUTH_COUNT': return '최대 인증 횟수를 초과했습니다. 카드사에 문의해주세요.'
    case 'REJECT_CARD_COMPANY': return '카드사에서 카드 등록을 거절했습니다. 카드사에 문의해주세요.'
    case 'REJECT_ACCOUNT_PAYMENT': return '잔액부족으로 카드 등록에 실패했습니다.'
    case 'COMMON_ERROR': return '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
    default: return '카드 등록에 실패했습니다. 카드 정보를 다시 확인해주세요.'
  }
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

    const { authKey, customerKey, advertisementId } = await req.json()

    if (!authKey || !customerKey || !advertisementId) {
      return new Response(
        JSON.stringify({ error: 'authKey, customerKey, advertisementId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const tossAuthHeader = 'Basic ' + btoa(TOSS_BILLING_SECRET_KEY + ':')
    const tossRes = await fetch(
      'https://api.tosspayments.com/v1/billing/authorizations/issue',
      {
        method: 'POST',
        headers: { Authorization: tossAuthHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ authKey, customerKey }),
      },
    )

    if (!tossRes.ok) {
      const tossError = await tossRes.json()
      console.error('[issue-billing-key] 토스 API 오류:', tossError)
      const userMessage = getBillingKeyErrorMessage(tossError.code ?? '')
      return new Response(
        JSON.stringify({ error: userMessage, code: tossError.code }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const tossData = await tossRes.json()
    console.log('[issue-billing-key] 토스 응답 전체:', JSON.stringify(tossData))

    const billingKey: string = tossData.billingKey
    const issuerCode: string = tossData.card?.issuerCode ?? null
    const cardCompany: string = tossData.cardCompany ?? (issuerCode ? ISSUER_CODE_MAP[issuerCode] ?? null : null)
    const cardNumber: string = tossData.cardNumber ?? tossData.card?.number ?? null
    const cardLastFour: string = cardNumber?.slice(-4) ?? null
    const cardType: string = tossData.card?.cardType ?? null
    const ownerType: string = tossData.card?.ownerType ?? null

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: ad, error: adError } = await supabase
      .from('advertisements_v2')
      .select('id, "partnerId", "freeMonths", "approvedMonthlyAmount", "approvedDiscountRate"')
      .eq('id', advertisementId)
      .single()

    if (adError || !ad) {
      throw new Error(`광고 조회 실패: ${adError?.message}`)
    }

    const partnerId: string = ad.partnerId

    // 4. 빌링키 암호화 후 upsert (기존 카드 있으면 update, 없으면 insert)
    const { data: billingKeyRow, error: billingKeyError } = await supabase.rpc(
      'upsert_billing_key_encrypted',
      {
        p_partner_id: partnerId,
        p_billing_key: billingKey,
        p_billing_key_secret: BILLING_KEY_SECRET,
        p_customer_key: customerKey,
        p_card_last_four: cardLastFour,
        p_card_company: cardCompany,
        p_card_number: cardNumber,
        p_card_type: cardType,
        p_owner_type: ownerType,
      },
    )

    if (billingKeyError) {
      throw new Error(`빌링키 저장 실패: ${billingKeyError.message}`)
    }

    const billingKeyId: string = billingKeyRow

    // 새 카드로 파트너의 active/grace_period 구독 billingKeyId 갱신 (non-critical)
    try {
      const { data: partnerAds } = await supabase
        .from('advertisements_v2')
        .select('id')
        .eq('partnerId', partnerId)

      if (partnerAds && partnerAds.length > 0) {
        const adIds = (partnerAds as Array<{ id: string }>).map((a) => a.id)
        await supabase
          .from('ad_subscriptions_v2')
          .update({ billingKeyId })
          .in('advertisementId', adIds)
          .in('subscriptionStatus', ['active', 'grace_period'])
        console.log(`[issue-billing-key] 구독 billingKeyId 갱신 완료 - partnerId: ${partnerId}`)
      }
    } catch (updateErr) {
      console.error('[issue-billing-key] 구독 billingKeyId 갱신 실패 (non-critical):', updateErr)
    }

    console.log(`[issue-billing-key] 완료 - billingKeyId: ${billingKeyId}, partnerId: ${partnerId}`)

    return new Response(
      JSON.stringify({ success: true, billingKeyId, cardNumber, cardLastFour, cardCompany, cardType, ownerType }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[issue-billing-key] 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
