import { redirect } from 'next/navigation';

// 파트너→아파트 전환 승인은 회원 관리 페이지에서 통합 처리
export default function MembershipConversionPage() {
  redirect('/admin/users');
}
