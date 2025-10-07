# 자동 승인 Cron Job 설정 가이드

## 개요
매일 오전 12시에 pending 상태인 APP_USER들을 자동으로 승인하는 기능입니다.

## API 엔드포인트
- **URL**: `/api/users/auto-approve`
- **Method**: POST
- **인증**: Bearer Token (CRON_SECRET_KEY 환경변수)

## 환경변수 설정

`.env.local` 또는 `.env.production`에 추가:
```
CRON_SECRET_KEY=your-secure-random-key-here
```

## Vercel Cron Jobs 설정

1. `vercel.json` 파일에 추가:
```json
{
  "crons": [
    {
      "path": "/api/users/auto-approve",
      "schedule": "0 15 * * *"
    }
  ]
}
```

> 참고: "0 15 * * *"는 UTC 기준 15:00 (한국시간 00:00)를 의미합니다.

## 대안: 외부 Cron 서비스 사용

### 1. Upstash (추천)
```javascript
// Upstash Qstash 설정
const response = await fetch('https://qstash.upstash.io/v1/publish', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_UPSTASH_TOKEN',
    'Upstash-Method': 'POST',
    'Upstash-Url': 'https://your-domain.com/api/users/auto-approve',
    'Upstash-Cron': '0 0 * * *',  // 매일 00:00
    'Upstash-Headers': JSON.stringify({
      'Authorization': 'Bearer YOUR_CRON_SECRET_KEY'
    })
  }
});
```

### 2. GitHub Actions
`.github/workflows/auto-approve.yml` 생성:
```yaml
name: Auto Approve Users

on:
  schedule:
    - cron: '0 15 * * *'  # UTC 15:00 (한국시간 00:00)
  workflow_dispatch:  # 수동 실행 가능

jobs:
  auto-approve:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Auto Approve
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET_KEY }}" \
            https://your-domain.com/api/users/auto-approve
```

### 3. Supabase Edge Functions (Supabase 사용시)
```sql
-- Supabase에서 pg_cron extension 활성화 후
SELECT cron.schedule(
  'auto-approve-users',
  '0 0 * * *',
  $$
    UPDATE public.user
    SET "approvalStatus" = 'approved'
    WHERE "approvalStatus" = 'pending'
    AND id IN (
      SELECT userId FROM user_roles WHERE role = 'APP_USER'
    );
  $$
);
```

## 테스트 방법

### 수동 실행:
```bash
curl -X POST http://localhost:3000/api/users/auto-approve \
  -H "Authorization: Bearer your-secret-key"
```

### 대기중인 사용자 수 확인:
```bash
curl http://localhost:3000/api/users/auto-approve
```

## 모니터링

- 로그 확인: Vercel Dashboard > Functions > Logs
- 실행 기록: `/api/users/auto-approve` 응답에 포함된 approved 수 확인
- 에러 알림: Vercel 또는 외부 모니터링 서비스 설정 권장

## 보안 고려사항

1. **CRON_SECRET_KEY**는 충분히 길고 랜덤한 값 사용
2. Production 환경에서는 반드시 API 키 검증 활성화
3. Rate limiting 적용 고려
4. IP 화이트리스트 설정 (가능한 경우)

## 트러블슈팅

### Cron이 실행되지 않는 경우
1. Timezone 설정 확인 (UTC vs KST)
2. Vercel Pro 플랜 확인 (무료 플랜은 Cron 미지원)
3. 환경변수 설정 확인

### API 호출 실패
1. CRON_SECRET_KEY 일치 여부 확인
2. 네트워크 연결 상태 확인
3. Supabase 연결 상태 확인