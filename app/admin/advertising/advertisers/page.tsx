'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  Building,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  X,
  Eye,
  FileText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { ImageUpload } from '@/components/image-upload';

interface Advertiser {
  id: string;
  businessName: string;
  businessType: string;
  representativeName: string;
  email: string;
  phoneNumber: string;
  landlineNumber?: string | null;
  businessRegistration: string | null;
  address: string;
  representativeImage: string | null;
  logo: string | null;
  description: string | null;
  website: string | null;
  contractStartDate: string;
  contractEndDate: string;
  contractDocument: string | null;
  contractMemo: string | null;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  user?: {
    name: string;
  };
}

interface AdCategory {
  id: string;
  categoryName: string;
  isActive: boolean;
}

type ContractStatus = 'active' | 'expiring' | 'expired';

export default function AdvertisersPage() {
  const supabase = createClient();

  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [categories, setCategories] = useState<AdCategory[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [contractFilter, setContractFilter] = useState<'all' | ContractStatus>('all');
  const [selectedManager, setSelectedManager] = useState<string>('all');

  // Create/Edit dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAdvertiser, setEditingAdvertiser] = useState<Advertiser | null>(null);
  const [currentAdvertiserId, setCurrentAdvertiserId] = useState<string>(''); // 현재 편집 중인 광고주 ID (신규는 UUID)
  const [imagePreview, setImagePreview] = useState<string | null>(null); // 이미지 크게 보기

  // ESC 키로 이미지 미리보기 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && imagePreview) {
        e.preventDefault();
        e.stopPropagation();
        setImagePreview(null);
      }
    };

    if (imagePreview) {
      document.addEventListener('keydown', handleEscape, true); // capture phase에서 처리
      return () => document.removeEventListener('keydown', handleEscape, true);
    }
  }, [imagePreview]);
  const [uploadedImages, setUploadedImages] = useState({
    logo: '',
    businessRegistration: '',
    representativeImage: '',
    contractDocument: '',
  }); // 업로드된 이미지들 추적
  const [form, setForm] = useState({
    businessName: '',
    businessType: '',
    representativeName: '',
    email: '',
    phoneNumber: '',
    landlineNumber: '',
    address: '',
    description: '',
    website: '',
    contractStartDate: '',
    contractEndDate: '',
    contractMemo: '',
    logo: '',
    businessRegistration: '',
    representativeImage: '',
    contractDocument: '',
    isActive: true,
  });

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deletingAdvertiser, setDeletingAdvertiser] = useState<Advertiser | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      // SUPER_ADMIN 권한 확인
      const roles = await getUserRoles();
      setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
    };
    fetchUser();
  }, []);

  // 핸드폰번호 포맷팅 (010-1234-5678)
  const formatMobileNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else if (numbers.length <= 11) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  // 유선전화번호 포맷팅 (02-123-1234, 031-123-4567 등)
  const formatLandlineNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '');

    // 02로 시작 (서울)
    if (numbers.startsWith('02')) {
      if (numbers.length <= 2) {
        return numbers;
      } else if (numbers.length <= 5) {
        return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
      } else if (numbers.length <= 9) {
        return `${numbers.slice(0, 2)}-${numbers.slice(2, 5)}-${numbers.slice(5)}`;
      } else {
        return `${numbers.slice(0, 2)}-${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
      }
    }
    // 그 외 지역번호 (031, 032, 051 등)
    else {
      if (numbers.length <= 3) {
        return numbers;
      } else if (numbers.length <= 6) {
        return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
      } else if (numbers.length <= 10) {
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 6)}-${numbers.slice(6)}`;
      } else {
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
      }
    }
  };

  // 광고주 목록 조회
  const fetchAdvertisers = useCallback(async () => {
    if (!currentUserId) return;

    setLoading(true);
    setError(null);

    try {
      // 현재 사용자 역할 확인
      const roles = await getUserRoles();
      const isSuperAdmin = roles.includes('SUPER_ADMIN');

      let query = supabase
        .from('advertisers')
        .select(`
          *,
          user:createdBy(name)
        `)
        .order('createdAt', { ascending: false });

      // SUPER_ADMIN이 아니면 자신이 등록한 광고주만 조회
      if (!isSuperAdmin) {
        query = query.eq('createdBy', currentUserId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setAdvertisers(data || []);
    } catch (err) {
      console.error('Failed to fetch advertisers:', err);
      setError('광고주 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, currentUserId]);

  // 카테고리 목록 조회
  const fetchCategories = async () => {
    const { data } = await supabase
      .from('ad_categories')
      .select('id, categoryName, isActive')
      .eq('isActive', true)
      .order('categoryName');
    setCategories(data || []);
  };

  // 매니저 목록 조회 (SUPER_ADMIN만)
  const fetchManagers = useCallback(async () => {
    if (!isSuperAdmin) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('userId, user:userId(id, name)')
        .in('role', ['MANAGER', 'SUPER_ADMIN']);

      if (error) throw error;

      // 중복 제거 및 매니저 목록 생성
      const uniqueManagers = data
        ?.filter((item: any) => item.user)
        .map((item: any) => ({
          id: item.user.id,
          name: item.user.name,
        }))
        .filter((manager, index, self) =>
          index === self.findIndex((m) => m.id === manager.id)
        ) || [];

      setManagers(uniqueManagers);
    } catch (err) {
      console.error('Failed to fetch managers:', err);
    }
  }, [supabase, isSuperAdmin]);

  useEffect(() => {
    fetchAdvertisers();
    fetchCategories();
    if (isSuperAdmin) {
      fetchManagers();
    }
  }, [fetchAdvertisers, fetchManagers, isSuperAdmin]);

  // 계약 상태 확인
  const getContractStatus = (advertiser: Advertiser): ContractStatus => {
    const now = new Date();
    const endDate = new Date(advertiser.contractEndDate);
    const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return 'expired';
    if (daysUntilExpiry <= 7) return 'expiring';
    return 'active';
  };

  // 광고주 생성/수정
  const handleSave = async () => {
    if (!form.businessName || !form.businessType || !form.representativeName || !form.email) {
      setError('필수 항목을 입력해주세요.');
      return;
    }

    try {
      const advertiserData = {
        businessName: form.businessName,
        businessType: form.businessType,
        representativeName: form.representativeName,
        email: form.email,
        phoneNumber: formatMobileNumber(form.phoneNumber),
        landlineNumber: form.landlineNumber ? formatLandlineNumber(form.landlineNumber) : null,
        address: form.address,
        description: form.description || null,
        website: form.website || null,
        contractStartDate: form.contractStartDate,
        contractEndDate: form.contractEndDate,
        contractMemo: form.contractMemo || null,
        logo: form.logo || null,
        businessRegistration: form.businessRegistration || null,
        representativeImage: form.representativeImage || null,
        contractDocument: form.contractDocument || null,
        isActive: form.isActive,
        createdBy: currentUserId,
      };

      if (editingAdvertiser) {
        // 수정
        const { error: updateError } = await supabase
          .from('advertisers')
          .update(advertiserData)
          .eq('id', editingAdvertiser.id);

        if (updateError) throw updateError;
      } else {
        // 생성
        const { error: insertError } = await supabase
          .from('advertisers')
          .insert(advertiserData);

        if (insertError) throw insertError;
      }

      // 저장 성공 시 uploadedImages 초기화 (다이얼로그 닫힐 때 삭제 방지)
      setUploadedImages({
        logo: '',
        businessRegistration: '',
        representativeImage: '',
        contractDocument: '',
      });
      setIsDialogOpen(false);
      resetForm();
      fetchAdvertisers();
    } catch (err: any) {
      console.error('Failed to save advertiser:', err);
      setError(err.message || '광고주 저장에 실패했습니다.');
    }
  };

  // 광고주 삭제
  const handleDeleteClick = (advertiser: Advertiser) => {
    setDeletingAdvertiser(advertiser);
    setDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAdvertiser) return;

    try {
      const bucket = 'advertisements';

      // 1. 해당 광고주의 모든 광고 조회 (Storage 이미지 삭제용)
      const { data: relatedAds } = await supabase
        .from('advertisements')
        .select('imageUrl')
        .eq('advertiserId', deletingAdvertiser.id);

      // 2. Storage에서 광고주의 파일들 삭제
      const filesToDelete: string[] = [];

      // 광고주 로고
      if (deletingAdvertiser.logo) {
        const urlParts = deletingAdvertiser.logo.split('/');
        const storagePathIndex = urlParts.indexOf('advertisements');
        if (storagePathIndex !== -1) {
          filesToDelete.push(urlParts.slice(storagePathIndex + 1).join('/'));
        }
      }

      // 사업자등록증
      if (deletingAdvertiser.businessRegistration) {
        const urlParts = deletingAdvertiser.businessRegistration.split('/');
        const storagePathIndex = urlParts.indexOf('advertisements');
        if (storagePathIndex !== -1) {
          filesToDelete.push(urlParts.slice(storagePathIndex + 1).join('/'));
        }
      }

      // 대표 이미지
      if (deletingAdvertiser.representativeImage) {
        const urlParts = deletingAdvertiser.representativeImage.split('/');
        const storagePathIndex = urlParts.indexOf('advertisements');
        if (storagePathIndex !== -1) {
          filesToDelete.push(urlParts.slice(storagePathIndex + 1).join('/'));
        }
      }

      // 계약서
      if (deletingAdvertiser.contractDocument) {
        const urlParts = deletingAdvertiser.contractDocument.split('/');
        const storagePathIndex = urlParts.indexOf('advertisements');
        if (storagePathIndex !== -1) {
          filesToDelete.push(urlParts.slice(storagePathIndex + 1).join('/'));
        }
      }

      // 관련 광고 이미지들
      if (relatedAds && relatedAds.length > 0) {
        relatedAds.forEach(ad => {
          if (ad.imageUrl) {
            const urlParts = ad.imageUrl.split('/');
            const storagePathIndex = urlParts.indexOf('advertisements');
            if (storagePathIndex !== -1) {
              filesToDelete.push(urlParts.slice(storagePathIndex + 1).join('/'));
            }
          }
        });
      }

      // Storage 파일 삭제
      if (filesToDelete.length > 0) {
        try {
          await supabase.storage.from(bucket).remove(filesToDelete);
          console.log('Deleted advertiser files from storage:', filesToDelete);
        } catch (storageError) {
          console.error('Failed to delete advertiser files from storage:', storageError);
          // Storage 삭제 실패해도 계속 진행
        }
      }

      // 3. DB에서 광고주 삭제 (CASCADE로 관련 광고도 자동 삭제됨)
      const { error: deleteError } = await supabase
        .from('advertisers')
        .delete()
        .eq('id', deletingAdvertiser.id);

      if (deleteError) throw deleteError;

      setDeleteDialog(false);
      setDeletingAdvertiser(null);
      fetchAdvertisers();
    } catch (err) {
      console.error('Failed to delete advertiser:', err);
      setError('광고주 삭제에 실패했습니다.');
    }
  };

  // 편집 시작
  const handleEditClick = (advertiser: Advertiser) => {
    setEditingAdvertiser(advertiser);
    setCurrentAdvertiserId(advertiser.id);
    setUploadedImages({
      logo: advertiser.logo || '',
      businessRegistration: advertiser.businessRegistration || '',
      representativeImage: advertiser.representativeImage || '',
      contractDocument: advertiser.contractDocument || '',
    });
    setForm({
      businessName: advertiser.businessName,
      businessType: advertiser.businessType,
      representativeName: advertiser.representativeName,
      email: advertiser.email,
      phoneNumber: advertiser.phoneNumber,
      landlineNumber: advertiser.landlineNumber || '',
      address: advertiser.address,
      description: advertiser.description || '',
      website: advertiser.website || '',
      contractStartDate: advertiser.contractStartDate?.split('T')[0] || '',
      contractEndDate: advertiser.contractEndDate?.split('T')[0] || '',
      contractMemo: advertiser.contractMemo || '',
      logo: advertiser.logo || '',
      businessRegistration: advertiser.businessRegistration || '',
      representativeImage: advertiser.representativeImage || '',
      contractDocument: advertiser.contractDocument || '',
      isActive: advertiser.isActive,
    });
    setIsDialogOpen(true);
  };

  // 폼 초기화
  const resetForm = () => {
    setEditingAdvertiser(null);
    // 새 광고주를 위한 고유 ID 생성
    const newId = `advertiser_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setCurrentAdvertiserId(newId);
    setUploadedImages({
      logo: '',
      businessRegistration: '',
      representativeImage: '',
      contractDocument: '',
    });
    setForm({
      businessName: '',
      businessType: '',
      representativeName: '',
      email: '',
      phoneNumber: '',
      landlineNumber: '',
      address: '',
      description: '',
      website: '',
      contractStartDate: '',
      contractEndDate: '',
      contractMemo: '',
      logo: '',
      businessRegistration: '',
      representativeImage: '',
      contractDocument: '',
      isActive: true,
    });
  };

  // 다이얼로그 닫기 처리 (취소 시 업로드된 이미지 삭제)
  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      // 다이얼로그가 닫힐 때
      // 이미지가 업로드되었으나 저장되지 않았다면 삭제
      const bucket = 'advertisements';
      const imagesToDelete: string[] = [];

      if (uploadedImages.logo) imagesToDelete.push(uploadedImages.logo);
      if (uploadedImages.businessRegistration) imagesToDelete.push(uploadedImages.businessRegistration);
      if (uploadedImages.representativeImage) imagesToDelete.push(uploadedImages.representativeImage);
      if (uploadedImages.contractDocument) imagesToDelete.push(uploadedImages.contractDocument);

      if (imagesToDelete.length > 0) {
        try {
          const paths = imagesToDelete.map(url => url.split('/').slice(-3).join('/'));
          await supabase.storage.from(bucket).remove(paths);
          console.log('Deleted unused uploaded images:', paths);
        } catch (err) {
          console.error('Failed to delete uploaded images:', err);
        }
      }

      setUploadedImages({
        logo: '',
        businessRegistration: '',
        representativeImage: '',
        contractDocument: '',
      });
    }
    setIsDialogOpen(open);
  };

  // 필터링된 광고주
  const filteredAdvertisers = advertisers.filter((advertiser) => {
    // 검색 필터
    const matchesSearch =
      advertiser.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      advertiser.representativeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      advertiser.email?.toLowerCase().includes(searchQuery.toLowerCase());

    // 카테고리 필터
    const matchesCategory =
      selectedCategory === 'all' || advertiser.businessType === selectedCategory;

    // 상태 필터
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && advertiser.isActive) ||
      (statusFilter === 'inactive' && !advertiser.isActive);

    // 계약 상태 필터
    const contractStatus = getContractStatus(advertiser);
    const matchesContract = contractFilter === 'all' || contractStatus === contractFilter;

    // 매니저 필터 (SUPER_ADMIN만)
    const matchesManager =
      selectedManager === 'all' || advertiser.createdBy === selectedManager;

    return matchesSearch && matchesCategory && matchesStatus && matchesContract && matchesManager;
  });

  // 통계
  const stats = {
    total: advertisers.length,
    active: advertisers.filter((a) => a.isActive).length,
    expiring: advertisers.filter((a) => getContractStatus(a) === 'expiring').length,
    expired: advertisers.filter((a) => getContractStatus(a) === 'expired').length,
  };

  // 카테고리별 광고주 수
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat.categoryName] = advertisers.filter((a) => a.businessType === cat.categoryName).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='광고주 관리' />

      <div className='flex-1 p-6 space-y-6 overflow-auto'>
        {/* 통계 카드 */}
        <div className='grid grid-cols-4 gap-4'>
          <Card>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>전체 광고주</p>
                  <p className='text-2xl font-bold'>{stats.total}</p>
                </div>
                <Building className='h-8 w-8 text-primary opacity-50' />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>활성 광고주</p>
                  <p className='text-2xl font-bold text-green-600'>{stats.active}</p>
                </div>
                <CheckCircle2 className='h-8 w-8 text-green-600 opacity-50' />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>만료 예정</p>
                  <p className='text-2xl font-bold text-orange-600'>{stats.expiring}</p>
                </div>
                <Clock className='h-8 w-8 text-orange-600 opacity-50' />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm text-muted-foreground'>만료됨</p>
                  <p className='text-2xl font-bold text-red-600'>{stats.expired}</p>
                </div>
                <XCircle className='h-8 w-8 text-red-600 opacity-50' />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 검색 & 필터 */}
        <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center'>
          <div className='relative flex-1 w-full'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='상호명, 대표자명, 이메일로 검색...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>

          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='상태' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              <SelectItem value='active'>활성</SelectItem>
              <SelectItem value='inactive'>비활성</SelectItem>
            </SelectContent>
          </Select>

          <Select value={contractFilter} onValueChange={(value: any) => setContractFilter(value)}>
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='계약 상태' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>전체</SelectItem>
              <SelectItem value='active'>진행중</SelectItem>
              <SelectItem value='expiring'>만료 예정</SelectItem>
              <SelectItem value='expired'>만료됨</SelectItem>
            </SelectContent>
          </Select>

          {isSuperAdmin && managers.length > 0 && (
            <Select value={selectedManager} onValueChange={setSelectedManager}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='매니저 선택' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>전체 매니저</SelectItem>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={() => {
              resetForm();
              setIsDialogOpen(true);
            }}
          >
            <Plus className='h-4 w-4 mr-2' />
            광고주 추가
          </Button>
        </div>

        {error && (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 카테고리 탭 */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className='w-full'>
          <TabsList className='w-full justify-start overflow-x-auto flex-nowrap'>
            <TabsTrigger value='all'>
              전체 <Badge variant='secondary' className='ml-2'>{advertisers.length}</Badge>
            </TabsTrigger>
            {categories.map((category) => (
              <TabsTrigger key={category.id} value={category.categoryName}>
                {category.categoryName}
                <Badge variant='secondary' className='ml-2'>
                  {categoryCounts[category.categoryName] || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className='mt-4'>
            <Card className='bg-card border-border'>
              <CardContent className='p-0'>
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow className='border-border hover:bg-transparent'>
                        <TableHead className='text-muted-foreground'>상호명</TableHead>
                        <TableHead className='text-muted-foreground'>카테고리</TableHead>
                        <TableHead className='text-muted-foreground'>대표자</TableHead>
                        <TableHead className='text-muted-foreground'>연락처</TableHead>
                        <TableHead className='text-muted-foreground'>계약기간</TableHead>
                        <TableHead className='text-muted-foreground'>계약상태</TableHead>
                        <TableHead className='text-muted-foreground'>상태</TableHead>
                        <TableHead className='text-muted-foreground'>등록자</TableHead>
                        <TableHead className='text-muted-foreground text-right'>작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={9} className='text-center py-12 text-muted-foreground'>
                            로딩 중...
                          </TableCell>
                        </TableRow>
                      ) : filteredAdvertisers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className='text-center py-12 text-muted-foreground'>
                            {searchQuery || statusFilter !== 'all' || contractFilter !== 'all'
                              ? '검색 결과가 없습니다.'
                              : '광고주가 없습니다.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAdvertisers.map((advertiser) => {
                          const contractStatus = getContractStatus(advertiser);
                          return (
                            <TableRow key={advertiser.id} className='border-border hover:bg-secondary/50'>
                              <TableCell>
                                <div className='flex items-center gap-2'>
                                  <Building className='h-4 w-4 text-muted-foreground' />
                                  <span className='font-medium'>{advertiser.businessName}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant='outline'>{advertiser.businessType}</Badge>
                              </TableCell>
                              <TableCell>{advertiser.representativeName}</TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                <div>{advertiser.email}</div>
                                <div>{advertiser.phoneNumber}</div>
                                {advertiser.landlineNumber && (
                                  <div className='text-xs'>{advertiser.landlineNumber}</div>
                                )}
                              </TableCell>
                              <TableCell className='text-muted-foreground text-sm'>
                                <div className='flex items-center gap-1'>
                                  <Calendar className='h-3 w-3' />
                                  {new Date(advertiser.contractStartDate).toLocaleDateString('ko-KR')}
                                </div>
                                <div className='flex items-center gap-1'>
                                  ~ {new Date(advertiser.contractEndDate).toLocaleDateString('ko-KR')}
                                </div>
                              </TableCell>
                              <TableCell>
                                {contractStatus === 'active' && (
                                  <Badge className='bg-green-500'>진행중</Badge>
                                )}
                                {contractStatus === 'expiring' && (
                                  <Badge className='bg-orange-500'>만료 예정</Badge>
                                )}
                                {contractStatus === 'expired' && (
                                  <Badge variant='destructive'>만료됨</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {advertiser.isActive ? (
                                  <Badge className='bg-green-500'>활성</Badge>
                                ) : (
                                  <Badge variant='secondary'>비활성</Badge>
                                )}
                              </TableCell>
                              <TableCell className='text-sm text-muted-foreground'>
                                {advertiser.user?.name || '알 수 없음'}
                              </TableCell>
                              <TableCell className='text-right'>
                                <div className='flex justify-end gap-2'>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => handleEditClick(advertiser)}
                                  >
                                    <Edit className='h-4 w-4' />
                                  </Button>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => handleDeleteClick(advertiser)}
                                    className='text-destructive hover:text-destructive'
                                  >
                                    <Trash2 className='h-4 w-4' />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog - 기존 코드 유지 */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className='sm:max-w-[700px] max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingAdvertiser ? '광고주 수정' : '광고주 추가'}</DialogTitle>
            <DialogDescription>광고주 정보를 입력합니다.</DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='businessName'>상호명 *</Label>
                <Input
                  id='businessName'
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  placeholder='○○필라테스'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='businessType'>카테고리 *</Label>
                <Select
                  value={form.businessType}
                  onValueChange={(value) => setForm({ ...form, businessType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='카테고리 선택' />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.categoryName}>
                        {category.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='representativeName'>대표자명 *</Label>
                <Input
                  id='representativeName'
                  value={form.representativeName}
                  onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
                  placeholder='홍길동'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='email'>이메일 *</Label>
                <Input
                  id='email'
                  type='email'
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder='business@example.com'
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='phoneNumber'>핸드폰번호 (선택)</Label>
                <Input
                  id='phoneNumber'
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: formatMobileNumber(e.target.value) })}
                  placeholder='010-1234-5678'
                  maxLength={13}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='landlineNumber'>유선전화번호 (선택)</Label>
                <Input
                  id='landlineNumber'
                  value={form.landlineNumber}
                  onChange={(e) => setForm({ ...form, landlineNumber: formatLandlineNumber(e.target.value) })}
                  placeholder='02-123-1234'
                  maxLength={13}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='website'>웹사이트 (선택)</Label>
              <Input
                id='website'
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder='https://example.com'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='address'>주소 (선택)</Label>
              <Input
                id='address'
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder='서울 관악구 봉천동 123-45'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>소개내용 (선택)</Label>
              <Textarea
                id='description'
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder='20년 경력의 전문 필라테스 강사진'
                rows={3}
              />
            </div>

            <div className='border-t pt-4'>
              <h4 className='font-medium mb-4'>이미지 파일 (선택)</h4>
              <div className='grid grid-cols-2 gap-6'>
                <div className='space-y-2'>
                  <Label>로고</Label>
                  <ImageUpload
                    bucket='advertisements'
                    storagePath='advertisers/logos'
                    fileName={currentAdvertiserId}
                    value={form.logo}
                    onChange={(url) => {
                      setForm({ ...form, logo: url });
                      setUploadedImages({ ...uploadedImages, logo: url });
                    }}
                    onPreviewClick={(url) => setImagePreview(url)}
                    accept='image/png,image/jpeg,image/svg+xml'
                    maxSizeMB={2}
                    previewSize='sm'
                    description='PNG, JPG, SVG, 최대 2MB'
                  />
                </div>

                <div className='space-y-2'>
                  <Label>대표 이미지</Label>
                  <ImageUpload
                    bucket='advertisements'
                    storagePath='advertisers/representative-images'
                    fileName={currentAdvertiserId}
                    value={form.representativeImage}
                    onChange={(url) => {
                      setForm({ ...form, representativeImage: url });
                      setUploadedImages({ ...uploadedImages, representativeImage: url });
                    }}
                    onPreviewClick={(url) => setImagePreview(url)}
                    accept='image/*'
                    maxSizeMB={5}
                    previewSize='sm'
                    description='최대 5MB'
                  />
                </div>

                <div className='space-y-2'>
                  <Label>사업자등록증</Label>
                  <ImageUpload
                    bucket='advertisements'
                    storagePath='advertisers/business-registrations'
                    fileName={currentAdvertiserId}
                    value={form.businessRegistration}
                    onChange={(url) => {
                      setForm({ ...form, businessRegistration: url });
                      setUploadedImages({ ...uploadedImages, businessRegistration: url });
                    }}
                    onPreviewClick={(url) => {
                      if (url.includes('.pdf')) {
                        // 쿼리 파라미터 제거
                        const cleanUrl = url.split('?')[0];
                        window.open(cleanUrl, '_blank');
                      } else {
                        setImagePreview(url);
                      }
                    }}
                    accept='image/*,application/pdf'
                    maxSizeMB={10}
                    previewSize='sm'
                    description='이미지 또는 PDF, 최대 10MB'
                  />
                </div>

                <div className='space-y-2'>
                  <Label>계약서</Label>
                  <ImageUpload
                    bucket='advertisements'
                    storagePath='advertisers/contracts'
                    fileName={currentAdvertiserId}
                    value={form.contractDocument}
                    onChange={(url) => {
                      setForm({ ...form, contractDocument: url });
                      setUploadedImages({ ...uploadedImages, contractDocument: url });
                    }}
                    onPreviewClick={(url) => {
                      if (url.includes('.pdf')) {
                        // 쿼리 파라미터 제거
                        const cleanUrl = url.split('?')[0];
                        window.open(cleanUrl, '_blank');
                      } else {
                        setImagePreview(url);
                      }
                    }}
                    accept='image/*,application/pdf'
                    maxSizeMB={10}
                    previewSize='sm'
                    description='이미지 또는 PDF, 최대 10MB'
                  />
                </div>
              </div>
            </div>

            <div className='border-t pt-4'>
              <h4 className='font-medium mb-4'>계약 정보 (선택)</h4>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='contractStartDate'>계약 시작일</Label>
                  <Input
                    id='contractStartDate'
                    type='date'
                    value={form.contractStartDate}
                    onChange={(e) => setForm({ ...form, contractStartDate: e.target.value })}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='contractEndDate'>계약 종료일</Label>
                  <Input
                    id='contractEndDate'
                    type='date'
                    value={form.contractEndDate}
                    onChange={(e) => setForm({ ...form, contractEndDate: e.target.value })}
                  />
                </div>
              </div>

              <div className='space-y-2 mt-4'>
                <Label htmlFor='contractMemo'>계약 메모</Label>
                <Textarea
                  id='contractMemo'
                  value={form.contractMemo}
                  onChange={(e) => setForm({ ...form, contractMemo: e.target.value })}
                  placeholder='월 50만원, 3개월 선불'
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setIsDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>{editingAdvertiser ? '수정' : '생성'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>광고주 삭제</DialogTitle>
            <DialogDescription>
              정말로 <strong>{deletingAdvertiser?.businessName}</strong>을(를) 삭제하시겠습니까?
              <br />이 광고주의 모든 광고도 함께 삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialog(false)}>
              취소
            </Button>
            <Button variant='destructive' onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {imagePreview && (
        <div
          className='fixed inset-0 bg-black/80 flex items-center justify-center p-8'
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            e.stopPropagation();
            setImagePreview(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            className='relative max-w-4xl max-h-[85vh] flex items-center justify-center'
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imagePreview}
              alt='미리보기'
              className='max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl'
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant='secondary'
              size='icon'
              className='absolute top-4 right-4 rounded-full shadow-lg'
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setImagePreview(null);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <X className='h-5 w-5' />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
