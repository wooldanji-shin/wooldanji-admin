-- =====================================================
-- 쿠폰 관리자 RLS 정책
-- =====================================================
-- 배경:
--   coupons / coupon_downloads / coupon_usages 테이블에는
--   "유저"와 "파트너 본인" 기준 정책만 존재해서,
--   어드민 페이지(/admin/coupons)에서 전체 목록이 조회되지 않았음.
--   (관리자 계정이 파트너로도 등록된 경우 본인 쿠폰만 보이고,
--    그 외 관리자 계정은 빈 목록이 표시됨)
--
-- 적용 상태: dev / prod 모두 적용 완료
--           (migration: add_admin_policies_for_coupons)
--
-- 참고: 기존 쿠폰 정책은 전부 PERMISSIVE라 OR로 결합된다.
--       따라서 아래 정책 추가로 기존 유저/파트너의 접근 범위는 변하지 않고,
--       is_admin()(user_roles의 MANAGER / SUPER_ADMIN)에만 접근이 추가된다.
--       APT_ADMIN은 is_admin() 대상이 아니므로 영향 없음.
-- =====================================================

-- 쿠폰 전체 조회
CREATE POLICY "관리자 쿠폰 전체 조회" ON public.coupons
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 쿠폰 비활성화(삭제 버튼)용 수정 권한
CREATE POLICY "관리자 쿠폰 수정" ON public.coupons
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 다운로드 수 집계
CREATE POLICY "관리자 쿠폰 다운로드 조회" ON public.coupon_downloads
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 사용 수 집계
CREATE POLICY "관리자 쿠폰 사용 조회" ON public.coupon_usages
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- =====================================================
-- Verification Queries
-- =====================================================
-- 관리자 세션에서 전체 쿠폰이 보이는지 확인:
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<관리자 userId>","role":"authenticated"}';
--   SELECT count(*) FROM coupons;
--
-- 파트너 계정은 여전히 본인 쿠폰만 보여야 함(회귀 검증):
--   SET LOCAL request.jwt.claims = '{"sub":"<파트너 userId>","role":"authenticated"}';
--   SELECT count(*) FROM coupons;
