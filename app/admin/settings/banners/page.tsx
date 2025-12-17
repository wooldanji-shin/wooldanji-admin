'use client';

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  Save,
  AlertCircle,
  Edit,
  Trash2,
  Plus,
  Building2,
  Globe,
  Search,
  X,
  Calendar,
  UserPlus,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/image-upload';
import { getUserRoles } from '@/lib/auth';
import { deleteFileFromStorage } from '@/lib/utils/storage';

interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  isGlobal: boolean;
  createdAt: string;
  createdBy: string | null;
  advertiserId: string | null;
  startDate: string | null;
  endDate: string | null;
  clickCount: number;
  description: string | null;
  user?: {
    id: string;
    name: string;
  } | null;
  advertiser?: {
    id: string;
    businessName: string;
    representativeName: string;
  } | null;
  home_banner_apartments?: {
    apartmentId: string;
    apartments: {
      id: string;
      name: string;
    };
  }[];
}

interface BannerForm {
  linkUrl: string;
  imageUrl: string;
  isActive: boolean;
  isGlobal: boolean;
  selectedApartments: string[];
  advertiserId: string | null;
  startDate: string;
  endDate: string;
  description: string;
}

interface Apartment {
  id: string;
  name: string;
  address: string;
}

interface Advertiser {
  id: string;
  businessName: string;
  representativeName: string;
}

const BUCKET_NAME = 'home-content';
const BANNERS_FOLDER = 'banners';

// 날짜 포맷 헬퍼 함수
const formatDisplayDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

function BannerRow({
  banner,
  onEdit,
  onDelete,
  onToggleActive,
  canEdit,
  canDelete,
}: {
  banner: Banner;
  onEdit: (banner: Banner) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <TableRow className='border-border hover:bg-secondary/50'>
      <TableCell>
        <div className='relative w-32 h-20 rounded overflow-hidden bg-muted'>
          <Image
            src={banner.imageUrl}
            alt='배너 이미지'
            fill
            className='object-cover'
          />
        </div>
      </TableCell>
      <TableCell className='max-w-xs truncate'>
        {banner.linkUrl ? (
          <a
            href={banner.linkUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {banner.linkUrl}
          </a>
        ) : (
          <span className='text-muted-foreground'>링크 없음</span>
        )}
      </TableCell>
      <TableCell>
        {banner.isGlobal ? (
          <Badge variant='default' className='gap-1'>
            <Globe className='h-3 w-3' />
            전체
          </Badge>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className='flex flex-wrap gap-1 cursor-pointer'>
                  {banner.home_banner_apartments?.slice(0, 2).map((hba) => (
                    <Badge key={hba.apartmentId} variant='outline' className='text-xs'>
                      <Building2 className='h-3 w-3 mr-1' />
                      {hba.apartments?.name}
                    </Badge>
                  ))}
                  {(banner.home_banner_apartments?.length || 0) > 2 && (
                    <Badge variant='outline' className='text-xs'>
                      +{(banner.home_banner_apartments?.length || 0) - 2}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side='bottom' className='max-w-xs bg-white border shadow-md p-0'>
                <div className='flex flex-col'>
                  <p className='font-semibold text-base text-black px-3 py-2 border-b'>
                    타겟 아파트 ({banner.home_banner_apartments?.length || 0}개)
                  </p>
                  {banner.home_banner_apartments?.map((hba, index) => (
                    <span
                      key={hba.apartmentId}
                      className={`text-base text-black px-3 py-1.5 ${
                        index !== (banner.home_banner_apartments?.length || 0) - 1 ? 'border-b' : ''
                      }`}
                    >
                      {hba.apartments?.name}
                    </span>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </TableCell>
      <TableCell>
        <span className='text-sm'>
          {banner.advertiser ? (
            <span className='font-medium'>{banner.advertiser.businessName}</span>
          ) : (
            <span className='text-muted-foreground'>-</span>
          )}
        </span>
      </TableCell>
      <TableCell>
        {banner.isGlobal ? (
          <span className='text-muted-foreground text-sm'>-</span>
        ) : (
          <div className='space-y-0.5 text-sm'>
            <div className='flex items-center gap-1 text-muted-foreground'>
              <Calendar className='h-3 w-3' />
              {formatDisplayDate(banner.startDate)}
            </div>
            <div className='flex items-center gap-1 text-muted-foreground'>
              <Calendar className='h-3 w-3' />
              {formatDisplayDate(banner.endDate)}
            </div>
          </div>
        )}
      </TableCell>
      <TableCell>
        <span className='text-sm'>
          {banner.user?.name || '-'}
        </span>
      </TableCell>
      <TableCell className='max-w-[150px]'>
        {banner.description ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className='text-sm truncate block cursor-pointer'>
                  {banner.description.length > 20 ? banner.description.substring(0, 20) + '...' : banner.description}
                </span>
              </TooltipTrigger>
              <TooltipContent side='bottom' className='max-w-xs bg-white border shadow-md'>
                <p className='text-sm text-black whitespace-pre-wrap'>{banner.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className='text-muted-foreground text-sm'>-</span>
        )}
      </TableCell>
      <TableCell>
        <Switch
          checked={banner.isActive}
          onCheckedChange={(checked) => onToggleActive(banner.id, checked)}
          disabled={!canEdit}
        />
      </TableCell>
      <TableCell>
        <div className='flex items-center gap-2'>
          {canEdit && (
            <Button
              variant='ghost'
              size='sm'
              onClick={(e) => {
                e.stopPropagation();
                onEdit(banner);
              }}
            >
              <Edit className='h-4 w-4' />
            </Button>
          )}
          {canDelete && (
            <Button
              variant='ghost'
              size='sm'
              onClick={(e) => {
                e.stopPropagation();
                onDelete(banner.id);
              }}
            >
              <Trash2 className='h-4 w-4 text-destructive' />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [apartmentSearch, setApartmentSearch] = useState('');
  const [form, setForm] = useState<BannerForm>({
    linkUrl: '',
    imageUrl: '',
    isActive: true,
    isGlobal: true,
    selectedApartments: [],
    advertiserId: null,
    startDate: '',
    endDate: '',
    description: '',
  });

  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const supabase = createClient();

  const isSuperAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('REGION_ADMIN');
  const isManager = userRoles.includes('MANAGER');

  // 현재 사용자 정보 조회
  useEffect(() => {
    const fetchUserInfo = async () => {
      const roles = await getUserRoles();
      setUserRoles(roles);

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUserInfo();
  }, [supabase]);

  // 아파트 목록 조회
  const fetchApartments = useCallback(async () => {
    if (!currentUserId) return;

    try {
      if (isSuperAdmin) {
        const { data } = await supabase
          .from('apartments')
          .select('id, name, address')
          .order('name');
        setApartments(data || []);
      } else {
        // 매니저는 자신이 등록한 아파트만 조회
        const { data: managerApartments } = await supabase
          .from('manager_apartments')
          .select('apartmentId, apartments:apartmentId(id, name, address)')
          .eq('managerId', currentUserId);

        if (managerApartments) {
          const apts = managerApartments
            .filter((ma: any) => ma.apartments)
            .map((ma: any) => ma.apartments)
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
          setApartments(apts);
        } else {
          setApartments([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch apartments:', err);
      setApartments([]);
    }
  }, [supabase, currentUserId, isSuperAdmin]);

  // 광고주 목록 조회
  const fetchAdvertisers = useCallback(async () => {
    if (!currentUserId) return;

    try {
      let query = supabase
        .from('advertisers')
        .select('id, businessName, representativeName')
        .order('businessName');

      // 매니저는 자신이 등록한 광고주만 조회
      if (isManager) {
        query = query.eq('createdBy', currentUserId);
      }

      const { data } = await query;
      setAdvertisers(data || []);
    } catch (err) {
      console.error('Failed to fetch advertisers:', err);
      setAdvertisers([]);
    }
  }, [supabase, currentUserId, isManager]);

  useEffect(() => {
    if (currentUserId) {
      loadBanners();
      fetchApartments();
      fetchAdvertisers();
    }
  }, [currentUserId, fetchApartments, fetchAdvertisers, isManager]);

  const loadBanners = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('home_banners')
        .select(`
          *,
          home_banner_apartments(
            apartmentId,
            apartments:apartmentId(id, name)
          )
        `)
        .order('createdAt', { ascending: false });

      // 매니저는 자신이 등록한 배너만 조회
      if (isManager && currentUserId) {
        query = query.eq('createdBy', currentUserId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // 게시자 정보 가져오기
      const creatorIds = [...new Set((data || []).map(b => b.createdBy).filter(Boolean))];
      let usersMap: Record<string, { id: string; name: string }> = {};

      if (creatorIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user')
          .select('id, name')
          .in('id', creatorIds);

        if (usersData) {
          usersMap = usersData.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
          }, {} as Record<string, { id: string; name: string }>);
        }
      }

      // 광고주 정보 가져오기
      const advertiserIds = [...new Set((data || []).map(b => b.advertiserId).filter(Boolean))];
      let advertisersMap: Record<string, { id: string; businessName: string; representativeName: string }> = {};

      if (advertiserIds.length > 0) {
        const { data: advertisersData } = await supabase
          .from('advertisers')
          .select('id, businessName, representativeName')
          .in('id', advertiserIds);

        if (advertisersData) {
          advertisersMap = advertisersData.reduce((acc, adv) => {
            acc[adv.id] = adv;
            return acc;
          }, {} as Record<string, { id: string; businessName: string; representativeName: string }>);
        }
      }

      // 배너에 user, advertiser 정보 추가
      const bannersWithInfo = (data || []).map(banner => ({
        ...banner,
        user: banner.createdBy ? usersMap[banner.createdBy] || null : null,
        advertiser: banner.advertiserId ? advertisersMap[banner.advertiserId] || null : null,
      }));

      setBanners(bannersWithInfo);
    } catch (err) {
      console.error('Error loading banners:', err);
      toast.error('배너를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 권한 체크 함수
  const canEditBanner = (banner: Banner) => {
    if (isSuperAdmin) return true;
    if (isManager && banner.createdBy === currentUserId) return true;
    return false;
  };

  const canDeleteBanner = (banner: Banner) => {
    if (isSuperAdmin) return true;
    if (isManager && banner.createdBy === currentUserId) return true;
    return false;
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const banner = banners.find(b => b.id === id);
    if (!banner || !canEditBanner(banner)) {
      toast.error('이 배너를 수정할 권한이 없습니다.');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('home_banners')
        .update({ isActive })
        .eq('id', id);

      if (updateError) throw updateError;

      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive } : b))
      );

      toast.success('활성화 상태가 변경되었습니다.');
    } catch (err) {
      console.error('Error toggling active:', err);
      toast.error('활성화 상태 변경 중 오류가 발생했습니다.');
    }
  };

  const handleAddNew = () => {
    setEditingBanner(null);
    setApartmentSearch('');
    setForm({
      linkUrl: '',
      imageUrl: '',
      isActive: true,
      isGlobal: isManager ? false : true, // 매니저는 기본값 false
      selectedApartments: [],
      advertiserId: null,
      startDate: '',
      endDate: '',
      description: '',
    });
    setDialogOpen(true);
  };

  const handleEdit = async (banner: Banner) => {
    if (!canEditBanner(banner)) {
      toast.error('이 배너를 수정할 권한이 없습니다.');
      return;
    }

    // 연결된 아파트 ID 조회
    const { data: apartmentData } = await supabase
      .from('home_banner_apartments')
      .select('apartmentId')
      .eq('bannerId', banner.id);

    const selectedApts = apartmentData?.map(a => a.apartmentId) || [];

    setEditingBanner(banner);
    setApartmentSearch('');
    setForm({
      linkUrl: banner.linkUrl || '',
      imageUrl: banner.imageUrl,
      isActive: banner.isActive,
      isGlobal: banner.isGlobal,
      selectedApartments: selectedApts,
      advertiserId: banner.advertiserId || null,
      startDate: banner.startDate ? banner.startDate.split('T')[0] : '',
      endDate: banner.endDate ? banner.endDate.split('T')[0] : '',
      description: banner.description || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // 이미지는 필수
      if (!form.imageUrl) {
        toast.error('배너 이미지를 업로드해주세요.');
        return;
      }

      // isGlobal이 false면 아파트 선택 필수
      if (!form.isGlobal && form.selectedApartments.length === 0) {
        toast.error('전체 대상이 아닌 경우 최소 하나의 아파트를 선택해야 합니다.');
        return;
      }

      // isGlobal이 false면 게시기간 필수
      if (!form.isGlobal && (!form.startDate || !form.endDate)) {
        toast.error('게시 기간을 설정해주세요.');
        return;
      }

      // isGlobal이 false면 광고주 필수
      if (!form.isGlobal && !form.advertiserId) {
        toast.error('광고주를 선택해주세요.');
        return;
      }

      // 매니저는 isGlobal 사용 불가
      if (isManager && form.isGlobal) {
        toast.error('매니저는 전체 대상 배너를 등록할 수 없습니다.');
        return;
      }

      const advertiserId = form.isGlobal ? null : form.advertiserId;

      const bannerData = {
        imageUrl: form.imageUrl,
        linkUrl: form.linkUrl.trim() || null,
        isActive: form.isActive,
        isGlobal: form.isGlobal,
        createdBy: editingBanner ? editingBanner.createdBy : currentUserId,
        advertiserId: advertiserId,
        startDate: form.isGlobal ? null : (form.startDate ? new Date(form.startDate + 'T00:00:00').toISOString() : null),
        endDate: form.isGlobal ? null : (form.endDate ? new Date(form.endDate + 'T23:59:59').toISOString() : null),
        description: form.isGlobal ? null : (form.description.trim() || null),
      };

      if (editingBanner) {
        const { error: updateError } = await supabase
          .from('home_banners')
          .update(bannerData)
          .eq('id', editingBanner.id);

        if (updateError) throw updateError;

        // 기존 아파트 연결 삭제
        await supabase
          .from('home_banner_apartments')
          .delete()
          .eq('bannerId', editingBanner.id);

        // 새 아파트 연결 추가 (isGlobal이 false인 경우만)
        if (!form.isGlobal && form.selectedApartments.length > 0) {
          await supabase
            .from('home_banner_apartments')
            .insert(
              form.selectedApartments.map(aptId => ({
                bannerId: editingBanner.id,
                apartmentId: aptId,
              }))
            );
        }

        toast.success('배너가 수정되었습니다.');
      } else {
        const { data: newBanner, error: insertError } = await supabase
          .from('home_banners')
          .insert(bannerData)
          .select()
          .single();

        if (insertError) throw insertError;

        // 아파트 연결 추가 (isGlobal이 false인 경우만)
        if (!form.isGlobal && form.selectedApartments.length > 0 && newBanner) {
          await supabase
            .from('home_banner_apartments')
            .insert(
              form.selectedApartments.map(aptId => ({
                bannerId: newBanner.id,
                apartmentId: aptId,
              }))
            );
        }

        toast.success('배너가 등록되었습니다.');
      }

      await loadBanners();
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error saving banner:', err);
      toast.error('배너 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const banner = banners.find(b => b.id === id);
    if (!banner || !canDeleteBanner(banner)) {
      toast.error('이 배너를 삭제할 권한이 없습니다.');
      return;
    }

    if (!confirm('이 배너를 삭제하시겠습니까?')) {
      return;
    }

    try {
      // 배너 이미지 스토리지에서 삭제
      if (banner.imageUrl) {
        await deleteFileFromStorage(banner.imageUrl);
      }

      // 광고주가 연결된 경우, 다른 곳에서 사용 중인지 확인
      if (banner.advertiserId) {
        // 다른 배너에서 사용 중인지 확인
        const { count: otherBannersCount } = await supabase
          .from('home_banners')
          .select('*', { count: 'exact', head: true })
          .eq('advertiserId', banner.advertiserId)
          .neq('id', id);

        // 광고에서 사용 중인지 확인
        const { count: adsCount } = await supabase
          .from('advertisements')
          .select('*', { count: 'exact', head: true })
          .eq('advertiserId', banner.advertiserId);

        // 다른 곳에서 사용되지 않으면 광고주도 삭제
        if ((otherBannersCount || 0) === 0 && (adsCount || 0) === 0) {
          // 광고주의 사업자등록증/계약서 파일 삭제
          const { data: advertiser } = await supabase
            .from('advertisers')
            .select('businessRegistration, contractDocument')
            .eq('id', banner.advertiserId)
            .single();

          if (advertiser) {
            if (advertiser.businessRegistration) {
              await deleteFileFromStorage(advertiser.businessRegistration);
            }
            if (advertiser.contractDocument) {
              await deleteFileFromStorage(advertiser.contractDocument);
            }
          }

          // 광고주 삭제
          await supabase
            .from('advertisers')
            .delete()
            .eq('id', banner.advertiserId);
        }
      }

      // 연결된 아파트 먼저 삭제 (CASCADE로 자동 삭제되지만 명시적으로)
      await supabase
        .from('home_banner_apartments')
        .delete()
        .eq('bannerId', id);

      const { error: deleteError } = await supabase
        .from('home_banners')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      toast.success('배너가 삭제되었습니다.');
      await loadBanners();
    } catch (err) {
      console.error('Error deleting banner:', err);
      toast.error('배너 삭제 중 오류가 발생했습니다.');
    }
  };

  const resetForm = () => {
    setForm({
      linkUrl: '',
      imageUrl: '',
      isActive: true,
      isGlobal: isManager ? false : true,
      selectedApartments: [],
      advertiserId: null,
      startDate: '',
      endDate: '',
      description: '',
    });
    setEditingBanner(null);
    setApartmentSearch('');
  };

  if (loading) {
    return (
      <div className='flex flex-col h-full'>
        <AdminHeader title='배너 광고 등록/수정' />
        <div className='flex-1 flex items-center justify-center'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      <AdminHeader title='배너 광고 등록/수정' />

      <div className='flex-1 p-6 overflow-auto'>
        <div className='space-y-6'>
          {/* Info Alert */}
          <Alert className='bg-muted/50 border-muted'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>
              홈 화면 상단에 표시되는 배너 광고를 관리합니다. 최신 등록순으로 정렬됩니다.
            </AlertDescription>
          </Alert>

          {/* Banners List */}
          <Card className='bg-card border-border'>
            <CardHeader className='flex flex-row items-center justify-between space-y-0'>
              <CardTitle className='text-card-foreground'>배너 목록</CardTitle>
              <Button onClick={handleAddNew}>
                <Plus className='h-4 w-4 mr-2' />
                새 배너
              </Button>
            </CardHeader>
            <CardContent>
              {banners.length === 0 ? (
                <div className='text-center py-12 text-muted-foreground'>
                  등록된 배너가 없습니다.
                </div>
              ) : (
                <div className='overflow-x-auto'>
                  <Table className='w-full'>
                    <TableHeader>
                      <TableRow className='border-border hover:bg-transparent'>
                        <TableHead className='w-32'>이미지</TableHead>
                        <TableHead className='w-32'>링크 URL</TableHead>
                        <TableHead className='w-32'>타겟</TableHead>
                        <TableHead className='w-28'>광고주</TableHead>
                        <TableHead className='w-28'>게시 기간</TableHead>
                        <TableHead className='w-20'>게시자</TableHead>
                        <TableHead className='w-32'>소개내용</TableHead>
                        <TableHead className='w-20'>활성화</TableHead>
                        <TableHead className='w-24'>작업</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {banners.map((banner) => (
                        <BannerRow
                          key={banner.id}
                          banner={banner}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onToggleActive={handleToggleActive}
                          canEdit={canEditBanner(banner)}
                          canDelete={canDeleteBanner(banner)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='min-w-[672px] max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editingBanner ? '배너 수정' : '새 배너 등록'}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-6 py-4'>
            {/* Image Upload */}
            <div className='space-y-2'>
              <Label className='text-sm font-medium'>
                배너 이미지 <span className='text-destructive'>*</span>
              </Label>
              <ImageUpload
                bucket={BUCKET_NAME}
                storagePath={BANNERS_FOLDER}
                value={form.imageUrl}
                onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
                accept='image/*'
                maxSizeMB={5}
                description='배너 이미지를 업로드하세요 (권장: 가로형 이미지)'
              />
            </div>

            {/* Link URL */}
            <div className='space-y-2'>
              <Label htmlFor='linkUrl' className='text-sm font-medium'>
                링크 URL <span className='text-muted-foreground'>(선택사항)</span>
              </Label>
              <Input
                id='linkUrl'
                type='url'
                value={form.linkUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                placeholder='https://example.com'
              />
              <p className='text-xs text-muted-foreground'>
                배너 클릭 시 이동할 URL을 입력하세요.
              </p>
            </div>

            {/* isGlobal Switch - 매니저는 사용 불가 */}
            {isSuperAdmin && (
              <div className='flex items-center justify-between p-4 border rounded-lg'>
                <div className='space-y-1'>
                  <Label htmlFor='isGlobal' className='text-sm font-medium flex items-center gap-2'>
                    <Globe className='h-4 w-4' />
                    전체 대상
                  </Label>
                  <p className='text-xs text-muted-foreground'>
                    활성화하면 모든 회원에게 배너가 표시됩니다.
                  </p>
                </div>
                <Switch
                  id='isGlobal'
                  checked={form.isGlobal}
                  onCheckedChange={(checked) => {
                    setForm((prev) => ({
                      ...prev,
                      isGlobal: checked,
                      selectedApartments: checked ? [] : prev.selectedApartments,
                    }));
                  }}
                />
              </div>
            )}

            {/* 광고주 섹션 - isGlobal이 false인 경우에만 표시 */}
            {!form.isGlobal && (
              <div className='space-y-2'>
                <Label className='text-sm font-medium flex items-center gap-2'>
                  <UserPlus className='h-4 w-4' />
                  광고주 선택 <span className='text-destructive'>*</span>
                </Label>
                <Select
                  value={form.advertiserId || ''}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      advertiserId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='광고주를 선택하세요' />
                  </SelectTrigger>
                  <SelectContent>
                    {advertisers.map((adv) => (
                      <SelectItem key={adv.id} value={adv.id}>
                        {adv.businessName} ({adv.representativeName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>
                  광고주가 없다면 먼저 광고주 관리 페이지에서 등록하세요.
                </p>
              </div>
            )}

            {/* 게시 기간 - isGlobal이 false인 경우에만 표시 */}
            {!form.isGlobal && (
              <div className='space-y-2'>
                <Label className='text-sm font-medium flex items-center gap-2'>
                  <Calendar className='h-4 w-4' />
                  게시 기간 <span className='text-destructive'>*</span>
                </Label>
                <div className='grid grid-cols-2 gap-3'>
                  <div className='space-y-2'>
                    <Label htmlFor='startDate' className='text-xs text-muted-foreground'>시작일</Label>
                    <Input
                      id='startDate'
                      type='date'
                      value={form.startDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='endDate' className='text-xs text-muted-foreground'>종료일</Label>
                    <Input
                      id='endDate'
                      type='date'
                      value={form.endDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, endDate: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className='flex gap-2 pt-1'>
                  {[30, 60, 90].map((days) => (
                    <Button
                      key={days}
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        const today = new Date();
                        const endDate = new Date();
                        endDate.setDate(today.getDate() + days);
                        setForm({
                          ...form,
                          startDate: today.toISOString().split('T')[0],
                          endDate: endDate.toISOString().split('T')[0],
                        });
                      }}
                    >
                      {days}일
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* 소개내용 - isGlobal이 false인 경우에만 표시 */}
            {!form.isGlobal && (
              <div className='space-y-2'>
                <Label htmlFor='description' className='text-sm font-medium'>
                  소개내용 <span className='text-destructive'>*</span>
                </Label>
                <Textarea
                  id='description'
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder='배너 소개내용을 입력하세요'
                  rows={3}
                />
              </div>
            )}

            {/* 아파트 선택 - isGlobal이 false인 경우에만 표시 */}
            {!form.isGlobal && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label className='text-sm font-medium'>
                    타겟 아파트 선택 <span className='text-destructive'>*</span>
                  </Label>
                  <div className='flex items-center gap-2'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setForm({ ...form, selectedApartments: apartments.map(a => a.id) })}
                    >
                      전체 선택
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => setForm({ ...form, selectedApartments: [] })}
                    >
                      전체 해제
                    </Button>
                  </div>
                </div>

                {/* 아파트 검색 및 체크박스 목록 */}
                <div className='border rounded-md'>
                  {/* 검색 입력 */}
                  <div className='p-2 border-b'>
                    <div className='relative'>
                      <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                      <Input
                        placeholder='아파트명 또는 주소 검색...'
                        value={apartmentSearch}
                        onChange={(e) => setApartmentSearch(e.target.value)}
                        className='pl-8 h-8'
                      />
                    </div>
                  </div>
                  <div className='h-[200px] overflow-y-auto'>
                    <div className='p-3 space-y-2'>
                      {(() => {
                        const filteredApartments = apartments.filter(apt =>
                          apt.name.toLowerCase().includes(apartmentSearch.toLowerCase()) ||
                          apt.address.toLowerCase().includes(apartmentSearch.toLowerCase())
                        );

                        if (apartments.length === 0) {
                          return (
                            <p className='text-sm text-muted-foreground text-center py-4'>
                              선택 가능한 아파트가 없습니다.
                            </p>
                          );
                        }

                        if (filteredApartments.length === 0) {
                          return (
                            <p className='text-sm text-muted-foreground text-center py-4'>
                              검색 결과가 없습니다.
                            </p>
                          );
                        }

                        return filteredApartments.map((apt) => (
                          <div
                            key={apt.id}
                            className='flex items-center space-x-3 p-2 rounded hover:bg-muted/50 cursor-pointer'
                            onClick={() => {
                              const isSelected = form.selectedApartments.includes(apt.id);
                              setForm({
                                ...form,
                                selectedApartments: isSelected
                                  ? form.selectedApartments.filter(id => id !== apt.id)
                                  : [...form.selectedApartments, apt.id]
                              });
                            }}
                          >
                            <Checkbox
                              id={`apt-${apt.id}`}
                              checked={form.selectedApartments.includes(apt.id)}
                              onCheckedChange={(checked) => {
                                setForm({
                                  ...form,
                                  selectedApartments: checked
                                    ? [...form.selectedApartments, apt.id]
                                    : form.selectedApartments.filter(id => id !== apt.id)
                                });
                              }}
                            />
                            <div className='flex-1 min-w-0'>
                              <label
                                htmlFor={`apt-${apt.id}`}
                                className='text-sm font-medium cursor-pointer block'
                              >
                                {apt.name}
                              </label>
                              <p className='text-xs text-muted-foreground truncate'>
                                {apt.address}
                              </p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>

                <p className='text-xs text-muted-foreground'>
                  선택된 아파트: {form.selectedApartments.length}개 / 전체 {apartments.length}개
                </p>

                {/* 선택된 아파트 뱃지 */}
                {form.selectedApartments.length > 0 && (
                  <div className='flex flex-wrap gap-2 pt-2'>
                    {form.selectedApartments.map((aptId) => {
                      const apt = apartments.find((a) => a.id === aptId);
                      return apt ? (
                        <Badge
                          key={aptId}
                          variant='secondary'
                          className='font-normal gap-1'
                        >
                          {apt.name}
                          <button
                            type='button'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setForm({
                                ...form,
                                selectedApartments: form.selectedApartments.filter(
                                  (id) => id !== aptId
                                ),
                              });
                            }}
                            className='ml-1 rounded-full hover:bg-muted-foreground/20'
                          >
                            <X className='h-3 w-3' />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Active Status */}
            <div className='flex items-center justify-between'>
              <Label htmlFor='isActive' className='text-sm font-medium'>
                활성화
              </Label>
              <Switch
                id='isActive'
                checked={form.isActive}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.imageUrl || (!form.isGlobal && !form.description.trim()) || (!form.isGlobal && !form.advertiserId)}>
              {saving ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className='mr-2 h-4 w-4' />
                  저장
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
