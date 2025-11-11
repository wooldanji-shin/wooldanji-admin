-- 광고 시스템 RLS 무한 재귀 문제 해결
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- advertisement_apartments 테이블 RLS 정책 재생성
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Everyone view ad apartments" ON advertisement_apartments;
DROP POLICY IF EXISTS "Managers insert ad apartments" ON advertisement_apartments;
DROP POLICY IF EXISTS "Managers delete ad apartments" ON advertisement_apartments;

-- 1. SELECT 정책 - 모든 인증된 사용자는 조회 가능
CREATE POLICY "Everyone view ad apartments"
ON advertisement_apartments FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. INSERT용 헬퍼 함수 생성 (SECURITY DEFINER로 무한 재귀 방지)
CREATE OR REPLACE FUNCTION public.can_manage_advertisement(ad_id uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.advertisements
    WHERE id = ad_id
      AND (
        "createdBy" = auth.uid()
        OR public.is_super_admin()
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. INSERT 정책 - 헬퍼 함수 사용
CREATE POLICY "Managers insert ad apartments"
ON advertisement_apartments FOR INSERT
WITH CHECK (
  public.can_manage_advertisement("advertisementId")
);

-- 4. DELETE 정책 - 헬퍼 함수 사용
CREATE POLICY "Managers delete ad apartments"
ON advertisement_apartments FOR DELETE
USING (
  public.can_manage_advertisement("advertisementId")
);
