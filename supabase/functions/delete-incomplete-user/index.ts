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
    // 환경 변수 확인
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
    }

    // 요청 데이터 파싱
    const { user_id } = await req.json()

    if (!user_id) {
      throw new Error('user_id가 필요합니다.')
    }

    console.log(`미완료 계정 삭제 요청: user_id=${user_id}`)

    // Supabase Admin 클라이언트 생성
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // user 테이블에 데이터가 있는지 확인
    const { data: userData, error: selectError } = await supabaseAdmin
      .from('user')
      .select('id')
      .eq('id', user_id)
      .maybeSingle()

    if (selectError) {
      console.error('user 테이블 조회 오류:', selectError)
      throw new Error(`사용자 조회 실패: ${selectError.message}`)
    }

    // user 테이블에 있으면 (가입 완료된 계정) 삭제하지 않음
    if (userData) {
      console.log(`가입 완료된 계정이므로 삭제하지 않음: user_id=${user_id}`)
      return new Response(
        JSON.stringify({
          success: false,
          message: '가입 완료된 계정은 삭제할 수 없습니다.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // user 테이블에 없으면 (미완료 가입) auth.users 삭제
    console.log(`미완료 계정 삭제 시작: user_id=${user_id}`)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (deleteError) {
      console.error('계정 삭제 오류:', deleteError)
      throw new Error(`계정 삭제 실패: ${deleteError.message}`)
    }

    console.log(`미완료 계정 삭제 완료: user_id=${user_id}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: '미완료 계정이 삭제되었습니다.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('미완료 계정 삭제 오류:', error)
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