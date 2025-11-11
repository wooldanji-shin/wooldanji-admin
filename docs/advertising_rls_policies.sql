-- 광고 시스템 RLS 정책
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 1. advertisers 테이블 RLS 정책
-- ============================================

-- RLS 활성화
ALTER TABLE advertisers ENABLE ROW LEVEL SECURITY;

-- 매니저는 자신이 등록한 광고주만 조회
CREATE POLICY "Managers view own advertisers"
ON advertisers FOR SELECT
USING (
  createdBy = auth.uid()
  OR
  public.is_super_admin()
);

-- 매니저는 광고주 생성 가능
CREATE POLICY "Managers insert advertisers"
ON advertisers FOR INSERT
WITH CHECK (
  createdBy = auth.uid()
  AND (public.is_manager() OR public.is_super_admin())
);

-- 매니저는 자신이 등록한 광고주 수정 가능
CREATE POLICY "Managers update own advertisers"
ON advertisers FOR UPDATE
USING (createdBy = auth.uid() OR public.is_super_admin())
WITH CHECK (createdBy = auth.uid() OR public.is_super_admin());

-- 매니저는 자신이 등록한 광고주 삭제 가능
CREATE POLICY "Managers delete own advertisers"
ON advertisers FOR DELETE
USING (createdBy = auth.uid() OR public.is_super_admin());


-- ============================================
-- 2. ad_categories 테이블 RLS 정책
-- ============================================

-- RLS 활성화
ALTER TABLE ad_categories ENABLE ROW LEVEL SECURITY;

-- 슈퍼 관리자만 생성/수정/삭제 가능
CREATE POLICY "Super admin manage categories"
ON ad_categories FOR ALL
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- 모든 인증된 사용자는 활성 카테고리 조회 가능
CREATE POLICY "Everyone view active categories"
ON ad_categories FOR SELECT
USING (auth.uid() IS NOT NULL);


-- ============================================
-- 3. advertisements 테이블 RLS 정책
-- ============================================

-- RLS 활성화
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- 매니저는 자신이 등록한 광고만 조회
CREATE POLICY "Managers view own ads"
ON advertisements FOR SELECT
USING (
  createdBy = auth.uid()
  OR
  public.is_super_admin()
  OR
  auth.uid() IS NOT NULL  -- 앱 사용자는 모든 광고 조회 가능 (필터링은 앱에서)
);

-- 매니저는 광고 생성 가능
CREATE POLICY "Managers insert ads"
ON advertisements FOR INSERT
WITH CHECK (
  createdBy = auth.uid()
  AND (public.is_manager() OR public.is_super_admin())
);

-- 매니저는 자신이 등록한 광고 수정 가능
CREATE POLICY "Managers update own ads"
ON advertisements FOR UPDATE
USING (createdBy = auth.uid() OR public.is_super_admin())
WITH CHECK (createdBy = auth.uid() OR public.is_super_admin());

-- 매니저는 자신이 등록한 광고 삭제 가능
CREATE POLICY "Managers delete own ads"
ON advertisements FOR DELETE
USING (createdBy = auth.uid() OR public.is_super_admin());


-- ============================================
-- 4. advertisement_apartments 테이블 RLS 정책
-- ============================================

-- RLS 활성화
ALTER TABLE advertisement_apartments ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 연결 조회 가능
CREATE POLICY "Everyone view ad apartments"
ON advertisement_apartments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 매니저는 자신의 광고에 대한 아파트 연결 생성 가능
CREATE POLICY "Managers insert ad apartments"
ON advertisement_apartments FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM advertisements
    WHERE id = advertisementId
      AND (createdBy = auth.uid() OR public.is_super_admin())
  )
);

-- 매니저는 자신의 광고에 대한 아파트 연결 삭제 가능
CREATE POLICY "Managers delete ad apartments"
ON advertisement_apartments FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM advertisements
    WHERE id = advertisementId
      AND (createdBy = auth.uid() OR public.is_super_admin())
  )
);


-- ============================================
-- 5. manager_profiles 테이블 RLS 정책
-- ============================================

-- RLS 활성화
ALTER TABLE manager_profiles ENABLE ROW LEVEL SECURITY;

-- 슈퍼 관리자는 모든 매니저 프로필 조회 가능
CREATE POLICY "Super admin view all manager profiles"
ON manager_profiles FOR SELECT
USING (public.is_super_admin());

-- 매니저는 자신의 프로필만 조회 가능
CREATE POLICY "Managers view own profile"
ON manager_profiles FOR SELECT
USING (userId = auth.uid());

-- 슈퍼 관리자만 매니저 프로필 생성 가능
CREATE POLICY "Super admin insert manager profiles"
ON manager_profiles FOR INSERT
WITH CHECK (public.is_super_admin());

-- 슈퍼 관리자와 본인만 프로필 수정 가능
CREATE POLICY "Managers update own profile"
ON manager_profiles FOR UPDATE
USING (userId = auth.uid() OR public.is_super_admin())
WITH CHECK (userId = auth.uid() OR public.is_super_admin());


-- ============================================
-- 6. manager_apartments 테이블 RLS 정책
-- ============================================

-- RLS 활성화
ALTER TABLE manager_apartments ENABLE ROW LEVEL SECURITY;

-- 슈퍼 관리자는 모든 매니저-아파트 연결 조회 가능
CREATE POLICY "Super admin view all manager apartments"
ON manager_apartments FOR SELECT
USING (public.is_super_admin());

-- 매니저는 자신의 아파트만 조회 가능
CREATE POLICY "Managers view own apartments"
ON manager_apartments FOR SELECT
USING (managerId = auth.uid());

-- 슈퍼 관리자만 매니저-아파트 연결 생성 가능
CREATE POLICY "Super admin insert manager apartments"
ON manager_apartments FOR INSERT
WITH CHECK (public.is_super_admin());

-- 슈퍼 관리자만 매니저-아파트 연결 삭제 가능
CREATE POLICY "Super admin delete manager apartments"
ON manager_apartments FOR DELETE
USING (public.is_super_admin());


-- ============================================
-- 헬퍼 함수 (이미 존재하지 않는 경우에만 생성)
-- ============================================

-- 매니저 역할 확인
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE "userId" = auth.uid()
      AND role = 'MANAGER'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 슈퍼 관리자 확인
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE "userId" = auth.uid()
      AND role = 'SUPER_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
