import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { UseUsersExportDeps, UseUsersExportReturn } from '../types';
import { getAgeFromBirthDay, getOverlayPermissionLabel } from '../utils';

/** CSV 내보내기 (SUPER_ADMIN 전용, 1000행 제한 없이 RPC로 전체 회원 조회) */
export function useUsersExport({ supabase }: UseUsersExportDeps): UseUsersExportReturn {
  const [exporting, setExporting] = useState(false);

  // CSV 내보내기 함수
  const handleExportCSV = useCallback(async (): Promise<void> => {
    setExporting(true);
    try {
      // RPC가 전체 회원을 JSON 하나로 반환 (권한 없으면 42501 에러)
      const { data: allData, error } = await (supabase as any).rpc('admin_export_users');
      if (error) throw error;

      if (!allData || allData.length === 0) {
        toast.error('내보낼 회원 데이터가 없습니다.');
        setExporting(false);
        return;
      }

      const data = allData;

      // CSV 헤더
      const headers = [
        '이름',
        '이메일',
        '전화번호',
        '회원유형',
        '아파트',
        '동',
        '호',
        '승인상태',
        '나이',
        '다른 앱 위에 표시',
        '문 연 횟수',
        '가입일',
      ];

      // CSV 데이터 생성
      const csvRows = data.map((user: any) => {
        const registrationType = user.registrationType === 'APARTMENT' ? '아파트' : '일반';
        const approvalStatus = user.approvalStatus === 'approve' ? '승인' :
                               user.approvalStatus === 'pending' ? '대기' :
                               user.approvalStatus === 'rejected' ? '거절' : user.approvalStatus;
        const createdAt = new Date(user.createdAt).toLocaleDateString('ko-KR');

        return [
          user.name || '',
          user.email || '',
          user.phoneNumber || '',
          registrationType,
          user.apartmentName || '',
          user.buildingNumber || '',
          user.unit || '',
          approvalStatus,
          getAgeFromBirthDay(user.birthDay) ?? '',
          getOverlayPermissionLabel(user.registrationType, user.overlayPermissionGranted),
          user.openDoorCount || 0,
          createdAt,
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
      });

      // CSV 파일 생성
      const BOM = '\uFEFF';
      const csvContent = BOM + [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      // 다운로드
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      link.download = `회원목록_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${data.length}명의 회원 데이터를 내보냈습니다.`);
    } catch (err) {
      console.error('CSV export failed:', err);
      toast.error('CSV 내보내기에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  }, [supabase]);

  return { exporting, handleExportCSV };
}
