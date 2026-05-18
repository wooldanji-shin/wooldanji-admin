import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SENS API 서명 생성 함수
function makeSignature(
  timestamp: string,
  method: string,
  url: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  const encoder = new TextEncoder()
  // 네이버 SENS API 서명 형식: Method + " " + URL + "\n" + Timestamp + "\n" + Access Key
  const message = `${method} ${url}\n${timestamp}\n${accessKey}`
  const data = encoder.encode(message)

  // HMAC-SHA256 서명 생성 (Secret Key를 키로 사용)
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(key =>
    crypto.subtle.sign('HMAC', key, data)
  ).then(signature => {
    const bytes = new Uint8Array(signature)
    return btoa(String.fromCharCode(...bytes))
  })
}

// 6자리 인증번호 생성
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 환경 변수 확인
    const SENS_SERVICE_ID = Deno.env.get('SENS_SERVICE_ID')
    const SENS_ACCESS_KEY = Deno.env.get('SENS_ACCESS_KEY')
    const SENS_SECRET_KEY = Deno.env.get('SENS_SECRET_KEY')
    const SENS_FROM_NUMBER = Deno.env.get('SENS_FROM_NUMBER')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SENS_SERVICE_ID || !SENS_ACCESS_KEY || !SENS_SECRET_KEY || !SENS_FROM_NUMBER) {
      throw new Error('SENS 환경 변수가 설정되지 않았습니다.')
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase 환경 변수가 설정되지 않았습니다.')
    }

    // 요청 데이터 파싱
    const { phoneNumber } = await req.json()

    if (!phoneNumber) {
      throw new Error('전화번호가 필요합니다.')
    }

    // 전화번호 정규화 (하이픈 제거)
    const normalizedPhone = phoneNumber.replace(/-/g, '')

    // Supabase 클라이언트 생성
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 인증번호 생성
    const verificationCode = generateVerificationCode()

    // DB에 인증번호 저장
    const { error: dbError } = await supabase
      .from('phone_verifications')
      .insert({
        phone_number: normalizedPhone,
        verification_code: verificationCode,
      })

    if (dbError) {
      console.error('DB 저장 오류:', dbError)
      throw new Error(`인증번호 저장 실패: ${dbError.message}`)
    }

    // SENS API 호출 준비
    const timestamp = Date.now().toString()
    const method = 'POST'
    const url = `/sms/v2/services/${SENS_SERVICE_ID}/messages`

    // 서명 생성 (비동기)
    const signature = await makeSignature(timestamp, method, url, SENS_ACCESS_KEY, SENS_SECRET_KEY)

    // SENS API 호출
    const sensResponse = await fetch(
      `https://sens.apigw.ntruss.com${url}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-ncp-apigw-timestamp': timestamp,
          'x-ncp-iam-access-key': SENS_ACCESS_KEY,
          'x-ncp-apigw-signature-v2': signature,
        },
        body: JSON.stringify({
          type: 'SMS',
          from: SENS_FROM_NUMBER,
          content: `[울단지] 인증번호는 [${verificationCode}]입니다.`,
          messages: [
            {
              to: normalizedPhone,
            },
          ],
        }),
      }
    )

    const sensData = await sensResponse.json()

    console.log('SENS API 응답:', sensData)

    if (sensData.statusCode !== '202') {
      throw new Error(`SMS 발송 실패: ${sensData.statusName || 'Unknown error'}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: '인증번호가 발송되었습니다.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('SMS 발송 오류:', error)
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