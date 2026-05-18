import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const responseHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy':
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src *;",
  'X-Frame-Options': 'ALLOWALL',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  }

  const url = new URL(req.url)
  const clientKey = url.searchParams.get('clientKey') ?? ''
  const customerKey = url.searchParams.get('customerKey') ?? ''
  const customerEmail = url.searchParams.get('email') ?? ''
  const customerName = url.searchParams.get('name') ?? ''

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>카드 등록</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
    #msg { font-family: sans-serif; color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <p id="msg">카드 등록 화면을 불러오는 중...</p>
  <script src="https://js.tosspayments.com/v2/standard"></script>
  <script>
    window.onload = async function () {
      try {
        document.getElementById('msg').style.display = 'none';
        const tossPayments = TossPayments(${JSON.stringify(clientKey)});
        const payment = tossPayments.payment({ customerKey: ${JSON.stringify(customerKey)} });
        await payment.requestBillingAuth({
          method: 'CARD',
          successUrl: 'wooldanji://billing/success',
          failUrl: 'wooldanji://billing/fail',
          customerEmail: ${JSON.stringify(customerEmail)},
          customerName: ${JSON.stringify(customerName)},
        });
      } catch (e) {
        console.error('[billing] 오류: ' + e);
        const msg = document.getElementById('msg');
        if (msg) {
          msg.style.display = 'block';
          msg.style.color = 'red';
          msg.textContent = '오류: ' + (e.message || String(e));
        }
      }
    };
  </script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: responseHeaders,
  })
})
