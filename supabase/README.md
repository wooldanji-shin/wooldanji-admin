# Supabase Setup Guide

## 🚀 RLS (Row Level Security) 설정 방법

### ⚠️ 중요: 순서대로 정확히 따라하세요!

---

### 1단계: Storage 버킷 생성

1. Supabase Dashboard 접속
2. **Storage** 메뉴 클릭
3. **New bucket** 버튼 클릭
4. 버킷 설정:
   - Name: `home-content`
   - Public bucket: ☑️ **체크 필수!** (앱에서 이미지 볼 수 있도록)
   - File size limit: 5MB (옵션)
5. **Create bucket** 클릭

> ✅ 버킷이 생성되면 다음 단계로!

### 2단계: 관리자 역할 부여

먼저 본인 계정에 관리자 역할을 부여해야 합니다.

**Supabase Dashboard > SQL Editor**에서 실행:

```sql
-- 본인의 user ID 확인 (로그인 후)
SELECT auth.uid();

-- 위에서 확인한 UUID를 사용하여 관리자 역할 추가
INSERT INTO user_roles ("userId", role, "createdAt")
VALUES (
  'YOUR_USER_ID_HERE',  -- 위에서 확인한 UUID로 교체
  'SUPER_ADMIN',
  now()
);
```

### 3단계: 테이블 RLS 정책 적용

**Supabase Dashboard > SQL Editor**에서 `setup_admin_rls.sql` 파일 전체 실행:

1. SQL Editor 열기
2. `supabase/setup_admin_rls.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭

> ✅ 성공 메시지 확인 후 다음 단계로!

---

### 4단계: Storage 정책 설정 (중요!)

**Supabase Dashboard > Storage > home-content > Policies**로 이동:

#### Policy 1: SELECT (Public read)
1. **New Policy** 클릭
2. 설정:
   - Policy name: `Public can read home-content`
   - Allowed operation: **SELECT** ☑️
   - Policy definition:
     ```sql
     true
     ```
   - Target roles: `authenticated`, `anon` (둘 다 체크)
3. **Save policy**

#### Policy 2: INSERT (Admin upload)
1. **New Policy** 클릭
2. 설정:
   - Policy name: `Admins can upload to home-content`
   - Allowed operation: **INSERT** ☑️
   - Policy definition:
     ```sql
     EXISTS (
       SELECT 1 FROM user_roles
       WHERE user_roles."userId" = auth.uid()
       AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
     )
     ```
   - Target roles: `authenticated` (체크)
3. **Save policy**

#### Policy 3: UPDATE (Admin update)
1. **New Policy** 클릭
2. 설정:
   - Policy name: `Admins can update home-content`
   - Allowed operation: **UPDATE** ☑️
   - Policy definition: (Policy 2와 동일)
     ```sql
     EXISTS (
       SELECT 1 FROM user_roles
       WHERE user_roles."userId" = auth.uid()
       AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
     )
     ```
   - Target roles: `authenticated` (체크)
3. **Save policy**

#### Policy 4: DELETE (Admin delete)
1. **New Policy** 클릭
2. 설정:
   - Policy name: `Admins can delete from home-content`
   - Allowed operation: **DELETE** ☑️
   - Policy definition: (Policy 2와 동일)
     ```sql
     EXISTS (
       SELECT 1 FROM user_roles
       WHERE user_roles."userId" = auth.uid()
       AND user_roles.role IN ('SUPER_ADMIN', 'APT_ADMIN', 'MANAGER')
     )
     ```
   - Target roles: `authenticated` (체크)
3. **Save policy**

> ✅ 4개의 정책이 모두 생성되었는지 확인!

---

### 5단계: 확인

Supabase SQL Editor에서 확인:

```sql
-- 본인의 역할 확인
SELECT * FROM user_roles WHERE "userId" = auth.uid();

-- 테이블 정책 확인
SELECT * FROM pg_policies
WHERE tablename IN ('home_notifications', 'home_headers');

-- Storage 정책 확인 (4개여야 함)
SELECT * FROM storage.policies WHERE bucket_id = 'home-content';
```

> ✅ 모든 확인이 끝나면 Next.js 설정으로!

---

## 📝 Next.js 설정 (이미 완료됨)

`next.config.ts` 파일에 Supabase 이미지 호스트가 추가되어 있습니다:

```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'rcotgpeujatuzgtdjqar.supabase.co',
      port: '',
      pathname: '/storage/v1/object/public/**',
    },
  ],
}
```

> ⚠️ Next.js 설정 변경 후 **개발 서버 재시작** 필수!
> ```bash
> # 개발 서버 중지 후 다시 시작
> npm run dev
> ```

---

## 🎉 설정 완료!

모든 단계를 완료했다면 이제 정상 작동해야 합니다:
- ✅ 헤더 설정 페이지
- ✅ 알림 관리 페이지 (이미지 업로드 포함)

---

## 🔧 문제 해결

### "new row violates row-level security policy" 에러

1. 본인 계정에 `SUPER_ADMIN` 역할이 있는지 확인
2. RLS 정책이 제대로 생성되었는지 확인
3. **Storage 정책이 4개 모두 생성되었는지 확인** (가장 흔한 원인)

### 406 에러 (테이블 조회 실패)

1. `home_notifications` 테이블의 RLS가 활성화되어 있는지 확인
2. SELECT 정책이 생성되었는지 확인
3. `user_roles` 테이블에 본인의 역할이 있는지 확인

### Next.js Image 에러 "hostname is not configured"

1. `next.config.ts`에 Supabase 호스트가 추가되었는지 확인
2. **개발 서버를 재시작** (설정 변경 후 필수!)

### Storage 업로드 실패

1. `home-content` 버킷이 **public**으로 생성되었는지 확인
2. Storage 정책이 **4개 모두** 추가되었는지 확인 (SELECT, INSERT, UPDATE, DELETE)
3. Policy definition이 정확한지 확인 (오타 주의)

## 권한 구조

### 테이블 접근 권한
- `SUPER_ADMIN`: 모든 권한
- `APT_ADMIN`: 아파트 관리자
- `MANAGER`: 매니저 (광고 및 콘텐츠 관리)

모든 admin 역할은 헤더/알림 관리 가능합니다.

### Storage 접근 권한
- **Upload/Update/Delete**: Admin 역할 필요
- **Read**: 모든 사용자 가능 (public bucket)
