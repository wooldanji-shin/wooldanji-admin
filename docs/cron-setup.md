# 회원 자동 승인 (pg_cron)

## 개요
승인 대기(`pending`) 중인 아파트 가입 일반 회원을 매일 자동으로 승인한다.
관리자 앱(Next.js)은 관여하지 않고, Supabase DB의 pg_cron이 DB 함수를 직접 실행한다.

> 예전에 있던 `/api/users/auto-approve` API와 `vercel.json` cron은 호출하는 곳이 없어 삭제했다 (2026-10-14).

## 동작
| 항목 | 값 |
|---|---|
| cron 작업 이름 | `auto-approve-users` |
| 일정 | `0 10 * * *` (UTC 10:00 = 한국시간 19:00) |
| 실행 내용 | `SELECT auto_approve_app_users();` |
| 적용 환경 | dev, prod 모두 |

`auto_approve_app_users()`는 아래 조건을 모두 만족하는 회원의 `approvalStatus`를 `'approve'`로 바꾼다.
- `approvalStatus = 'pending'`
- `registrationType = 'APARTMENT'`
- `user_roles`에 `APP_USER` 역할이 있음
- `APT_ADMIN`, `MANAGER`, `SUPER_ADMIN` 역할이 없음 (관리자 계정은 자동 승인하지 않음)

## 확인 방법 (SQL 에디터)
```sql
-- cron 등록 상태
SELECT jobid, jobname, schedule, active, command
FROM cron.job
WHERE jobname = 'auto-approve-users';

-- 최근 실행 기록
SELECT start_time, status, return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-approve-users')
ORDER BY start_time DESC
LIMIT 10;

-- 함수 정의
SELECT pg_get_functiondef('public.auto_approve_app_users'::regproc);
```

## 변경 시 주의
- 일정이나 조건을 바꾸면 dev에서 먼저 확인한 뒤 prod에 반영한다. prod 변경은 승인 후에만 한다.
- 함수 정의는 `docs/table_structure.md`의 `auto-approve-users` 항목과 함께 맞춰 둔다.
