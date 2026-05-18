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
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
    }

    // 요청 데이터 파싱
    const { phoneNumber, verificationCode } = await req.json()

    if (!phoneNumber || !verificationCode) {
      throw new Error('전화번호와 인증번호가 필요합니다.')
    }

    // 전화번호 정규화
    const normalizedPhone = phoneNumber.replace(/-/g, '')

    // Supabase 클라이언트 생성
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 가장 최근의 유효한 인증번호 조회
    const { data, error } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone_number', normalizedPhone)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      console.error('인증 정보 조회 실패:', error)
      throw new Error('유효한 인증 요청을 찾을 수 없습니다. 인증번호를 다시 요청해주세요.')
    }

    // 시도 횟수 제한 확인 (5회)
    if (data.attempts >= 5) {
      throw new Error('인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.')
    }

    // 시도 횟수 증가
    await supabase
      .from('phone_verifications')
      .update({ attempts: data.attempts + 1 })
      .eq('id', data.id)

    // 인증번호 확인
    if (data.verification_code !== verificationCode) {
      throw new Error('인증번호가 맞지 않습니다.')
    }

    // 인증 성공 시 레코드 삭제 (민감한 정보 제거)
    const { error: deleteError } = await supabase
      .from('phone_verifications')
      .delete()
      .eq('id', data.id)

    if (deleteError) {
      console.error('인증 레코드 삭제 실패:', deleteError)
      // 삭제 실패해도 인증은 성공으로 처리 (레코드는 만료 시간 지나면 자동 삭제됨)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '인증이 완료되었습니다.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('인증 확인 오류:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || '알 수 없는 오류가 발생했습니다.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})