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

    const { subscriptionId, cancelReason } = await req.json()

    if (!subscriptionId) {
      return new Response(
        JSON.stringify({ error: 'subscriptionId는 필수입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. 구독 조회 (freeEndDate는 ad_subscriptions_v2에 있음)
    const { data: sub, error: subError } = await supabase
      .from('ad_subscriptions_v2')
      .select('id, "advertisementId", "subscriptionStatus", "nextBillingDate", "freeEndDate"')
      .eq('id', subscriptionId)
      .single()

    if (subError || !sub) {
      throw new Error(`구독 조회 실패: ${subError?.message}`)
    }

    if (!['active', 'grace_period'].includes(sub.subscriptionStatus)) {
      return new Response(
        JSON.stringify({ error: `취소 불가 상태: ${sub.subscriptionStatus}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const now = new Date().toISOString()

    // 2. 무료체험 여부 확인 (freeEndDate가 현재 시각보다 미래이면 무료체험 중)
    const isInFreeTrial = sub.freeEndDate != null && new Date(sub.freeEndDate) > new Date(now)

    if (isInFreeTrial) {
      // 무료체험 중 → 즉시 종료 처리
      const { error: updateSubError } = await supabase
        .from('ad_subscriptions_v2')
        .update({
          subscriptionStatus: 'cancelled',
          cancelRequestedAt: now,
          cancelEffectiveAt: now,
          cancelReason: cancelReason ?? null,
          updatedAt: now,
        })
        .eq('id', subscriptionId)

      if (updateSubError) {
        throw new Error(`구독 즉시 취소 처리 실패: ${updateSubError.message}`)
      }

      const { error: adUpdateError } = await supabase
        .from('advertisements_v2')
        .update({
          adStatus: 'ended',
          hasCancelledSubscription: true,
          apartmentChangeStatus: null,
          pendingChanges: null,
          modificationStatus: null,
          modificationRejectedReason: null,
        })
        .eq('id', sub.advertisementId)

      if (adUpdateError) {
        throw new Error(`광고 즉시 종료 처리 실패: ${adUpdateError.message}`)
      }

      console.log(`[cancel-subscription] 무료체험 즉시 종료 - subscriptionId: ${subscriptionId}`)
    } else {
      // 3. 일반 구독 → cancel_pending으로 변경 (nextBillingDate에 종료)
      const { error: updateSubError } = await supabase
        .from('ad_subscriptions_v2')
        .update({
          subscriptionStatus: 'cancel_pending',
          cancelRequestedAt: now,
          cancelEffectiveAt: sub.nextBillingDate,
          cancelReason: cancelReason ?? null,
          updatedAt: now,
        })
        .eq('id', subscriptionId)

      if (updateSubError) {
        throw new Error(`구독 취소 처리 실패: ${updateSubError.message}`)
      }

      // 4. 광고 플래그 업데이트 + 진행 중인 수정/아파트 변경 초기화
      //    pending_next_cycle은 관리자가 이미 승인한 변경이므로 cancel_pending에서도 유지
      const { data: adData } = await supabase
        .from('advertisements_v2')
        .select('apartmentChangeStatus')
        .eq('id', sub.advertisementId)
        .single()

      const isPendingNextCycle = adData?.apartmentChangeStatus === 'pending_next_cycle'

      const { error: adUpdateError } = await supabase
        .from('advertisements_v2')
        .update({
          hasCancelledSubscription: true,
          // pending_next_cycle은 이미 승인된 아파트 변경 예약이므로 유지
          // pendingChanges에 아파트 ID가 담겨있어 null로 초기화하면 변경예정 데이터가 사라짐
          ...(isPendingNextCycle ? {} : { apartmentChangeStatus: null, pendingChanges: null }),
          modificationStatus: null,
          modificationRejectedReason: null,
        })
        .eq('id', sub.advertisementId)

      if (adUpdateError) {
        throw new Error(`광고 취소 플래그 업데이트 실패: ${adUpdateError.message}`)
      }

      console.log(`[cancel-subscription] cancel_pending 완료 - subscriptionId: ${subscriptionId}`)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('[cancel-subscription] 오류:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
