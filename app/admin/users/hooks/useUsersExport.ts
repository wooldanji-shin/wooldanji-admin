import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { UseUsersExportDeps, UseUsersExportReturn } from '../types';

/** CSV 내보내기 (전체 회원, 매니저는 관리 아파트 범위) */
export function useUsersExport({ supabase, isManager, authUserId }: UseUsersExportDeps): UseUsersExportReturn {
  const [exporting, setExporting] = useState(false);

  // CSV 내보내기 함수
  const handleExportCSV = useCallback(async (): Promise<void> => {
    setExporting(true);
    try {
      // 매니저인 경우 아파트 ID 목록 먼저 가져오기 (역할은 AuthGuard가 확인한 값을 사용)
      let apartmentIds: string[] = [];
      if (isManager) {
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId')
          .eq('managerId', authUserId);

        if (managerApartments && managerApartments.length > 0) {
          apartmentIds = managerApartments.map((ma: any) => ma.apartmentId);
        } else {
          toast.error('관리하는 아파트가 없습니다.');
          setExporting(false);
          return;
        }
      }

      // 페이지네이션으로 모든 데이터 가져오기
      const allData: any[] = [];
      const pageSize = 1000;
      let from = 0;

      while (true) {
        let query = supabase
          .from('user')
          .select(`
            *,
            user_roles!inner(id, role, createdAt),
            apartments:apartmentId(id, name, address)
          `)
          .eq('user_roles.role', 'APP_USER')
          .order('createdAt', { ascending: false })
          .range(from, from + pageSize - 1);

        if (isManager && apartmentIds.length > 0) {
          query = query.in('apartmentId', apartmentIds);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData.push(...data);
        if (data.length < pageSize) break; // 마지막 페이지
        from += pageSize;
      }

      if (allData.length === 0) {
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
        '문 연 횟수',
        '가입일',
      ];

      // CSV 데이터 생성
      const csvRows = data.map((user: any) => {
        const apartment = user.apartments as any;
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
          apartment?.name || '',
          user.buildingNumber || '',
          user.unit || '',
          approvalStatus,
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
  }, [supabase, isManager, authUserId]);

  return { exporting, handleExportCSV };
}
