import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('필수 환경 변수가 설정되지 않았습니다.')
    }

    const { subscriptionId } = await req.json()

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ error: 'subscriptionId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. 구독 조회
    const { data: sub, error: subError } = await supabase
      .from('ad_subscriptions_v2')
      .select('id, "advertisementId", "subscriptionStatus", "graceEndDate"')
      .eq('id', subscriptionId)
      .single()

    if (subError || !sub) {
      throw new Error(`구독 조회 실패: ${subError?.message}`)
    }

    if (sub.subscriptionStatus !== 'cancel_pending') {
      return new Response(
        JSON.stringify({ error: `철회 불가 상태: ${sub.subscriptionStatus}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 2. 원래 상태 복원: graceEndDate가 아직 미래면 grace_period, 아니면 active
    const now = new Date()
    const revertedStatus = sub.graceEndDate && new Date(sub.graceEndDate) > now
      ? 'grace_period'
      : 'active'

    // 3. 구독 상태 복원 (cancel 관련 필드 초기화)
    const { error: updateSubError } = await supabase
      .from('ad_subscriptions_v2')
      .update({
        subscriptionStatus: revertedStatus,
        cancelRequestedAt: null,
        cancelEffectiveAt: null,
        cancelReason: null,
        updatedAt: now.toISOString(),
      })
      .eq('id', subscriptionId)

    if (updateSubError) {
      throw new Error(`구독 철회 처리 실패: ${updateSubError.message}`)
    }

    // 4. 광고 hasCancelledSubscription = false 복원
    const { error: adUpdateError } = await supabase
      .from('advertisements_v2')
      .update({ hasCancelledSubscription: false })
      .eq('id', sub.advertisementId)

    if (adUpdateError) {
      throw new Error(`광고 취소 플래그 복원 실패: ${adUpdateError.message}`)
    }

    console.log(`[resume-subscription] 완료 - subscriptionId: ${subscriptionId}, revertedStatus: ${revertedStatus}`)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[resume-subscription] 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
