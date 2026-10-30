'use client';

import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { confirmModal } from '@/components/confirm-modal';
import { TableSkeleton } from '@/components/skeletons';
import { LinkedAdPicker, type LinkableAd } from './LinkedAdPicker';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Group,
  HoverCard,
  Input,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
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
  Calendar,
  RotateCcw,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ImageUpload } from '@/components/image-upload';
import { getUserRoles } from '@/lib/auth';
import { deleteFileFromStorage } from '@/lib/utils/storage';

interface Banner {
  id: string;
  imageUrl: string;
  additionalImageUrl: string | null;
  linkUrl: string | null;
  isActive: boolean;
  isGlobal: boolean;
  createdAt: string;
  createdBy: string | null;
  startDate: string | null;
  endDate: string | null;
  clickCount: number;
  adClickCount: number;
  description: string | null;
  isDirectLink: boolean;
  /** normal(기본) / ajl(아정당 — 링크 2개 중 선택 후 인앱 웹뷰) / ad(연결된 광고 상세로 이동) */
  bannerType: 'normal' | 'ajl' | 'ad';
  secondLinkUrl: string | null;
  linkedAdId: string | null;
  linkedPremiumAdId: string | null;
  user?: {
    id: string;
    name: string;
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
  isDirectLink: boolean;
  isAjl: boolean;
  secondLinkUrl: string;
  /** 광고 연결 배너 — 탭하면 앱이 연결된 광고 상세로 바로 이동 */
  isAdLink: boolean;
  linkedAdId: string | null;
  linkedPremiumAdId: string | null;
  imageUrl: string;
  additionalImageUrl: string;
  isActive: boolean;
  isGlobal: boolean;
  selectedApartments: string[];
  startDate: string;
  endDate: string;
  description: string;
}

interface Apartment {
  id: string;
  name: string;
  address: string;
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
  onResetClick,
  canEdit,
  canDelete,
  hideClickCounts,
  toggling,
}: {
  banner: Banner;
  onEdit: (banner: Banner) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onResetClick: (banner: Banner) => void;
  canEdit: boolean;
  canDelete: boolean;
  hideClickCounts: boolean;
  toggling: boolean;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Box
          pos="relative"
          w={128}
          h={80}
          bg="var(--app-bg-muted)"
          style={{ overflow: 'hidden', borderRadius: 'var(--mantine-radius-sm)' }}
        >
          <Image src={banner.imageUrl} alt="배너 이미지" fill className="object-cover" />
        </Box>
      </Table.Td>
      <Table.Td maw={320}>
        {banner.linkUrl ? (
          <Anchor
            href={banner.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            truncate
            display="block"
          >
            {banner.linkUrl}
          </Anchor>
        ) : (
          <Text size="sm" c="dimmed">
            링크 없음
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {banner.isGlobal ? (
          <Badge variant="filled" color="blue" leftSection={<Globe size={12} />}>
            전체
          </Badge>
        ) : (
          <HoverCard position="bottom" shadow="md" withinPortal>
            <HoverCard.Target>
              <Group gap={4} style={{ cursor: 'pointer' }}>
                {banner.home_banner_apartments?.slice(0, 2).map((hba) => (
                  <Badge
                    key={hba.apartmentId}
                    variant="light"
                    color="gray"
                    size="sm"
                    tt="none"
                    leftSection={<Building2 size={12} />}
                  >
                    {hba.apartments?.name}
                  </Badge>
                ))}
                {(banner.home_banner_apartments?.length || 0) > 2 && (
                  <Badge variant="light" color="gray" size="sm">
                    +{(banner.home_banner_apartments?.length || 0) - 2}
                  </Badge>
                )}
              </Group>
            </HoverCard.Target>
            <HoverCard.Dropdown p={0} maw={320}>
              <Stack gap={0}>
                <Text
                  fw={600}
                  px="sm"
                  py="xs"
                  style={{ borderBottom: '1px solid var(--app-divider)' }}
                >
                  타겟 아파트 ({banner.home_banner_apartments?.length || 0}개)
                </Text>
                {banner.home_banner_apartments?.map((hba, index) => (
                  <Text
                    key={hba.apartmentId}
                    px="sm"
                    py={6}
                    style={
                      index !== (banner.home_banner_apartments?.length || 0) - 1
                        ? { borderBottom: '1px solid var(--app-divider)' }
                        : undefined
                    }
                  >
                    {hba.apartments?.name}
                  </Text>
                ))}
              </Stack>
            </HoverCard.Dropdown>
          </HoverCard>
        )}
      </Table.Td>
      <Table.Td>
        {banner.isGlobal ? (
          <Text size="sm" c="dimmed">
            -
          </Text>
        ) : (
          <Stack gap={2}>
            <Group gap={4} wrap="nowrap">
              <Calendar size={12} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                {formatDisplayDate(banner.startDate)}
              </Text>
            </Group>
            <Group gap={4} wrap="nowrap">
              <Calendar size={12} color="var(--mantine-color-dimmed)" />
              <Text size="sm" c="dimmed">
                {formatDisplayDate(banner.endDate)}
              </Text>
            </Group>
          </Stack>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm">{banner.user?.name || '-'}</Text>
      </Table.Td>
      <Table.Td maw={150}>
        {banner.description ? (
          <HoverCard position="bottom" shadow="md" withinPortal>
            <HoverCard.Target>
              <Text size="sm" truncate display="block" style={{ cursor: 'pointer' }}>
                {banner.description.length > 20 ? banner.description.substring(0, 20) + '...' : banner.description}
              </Text>
            </HoverCard.Target>
            <HoverCard.Dropdown maw={320}>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {banner.description}
              </Text>
            </HoverCard.Dropdown>
          </HoverCard>
        ) : (
          <Text size="sm" c="dimmed">
            -
          </Text>
        )}
      </Table.Td>
      {!hideClickCounts && (
        <>
          <Table.Td>
            <Text size="sm">{banner.adClickCount?.toLocaleString() || 0}</Text>
          </Table.Td>
          <Table.Td>
            <Text size="sm">{banner.clickCount?.toLocaleString() || 0}</Text>
          </Table.Td>
        </>
      )}
      <Table.Td>
        <Switch
          checked={banner.isActive}
          onChange={(e) => onToggleActive(banner.id, e.currentTarget.checked)}
          disabled={!canEdit || toggling}
        />
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          {canEdit && (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="수정"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(banner);
              }}
            >
              <Edit size={16} />
            </ActionIcon>
          )}
          {canEdit && (
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={(e) => {
                e.stopPropagation();
                onResetClick(banner);
              }}
              title="클릭수 초기화"
              aria-label="클릭수 초기화"
            >
              <RotateCcw size={16} />
            </ActionIcon>
          )}
          {canDelete && (
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label="삭제"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(banner.id);
              }}
            >
              <Trash2 size={16} />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [apartmentSearch, setApartmentSearch] = useState('');
  // 연결한 광고 — 배너 대상 아파트를 이 광고의 노출 아파트 안으로 제한한다
  const [linkedAd, setLinkedAd] = useState<LinkableAd | null>(null);
  const [form, setForm] = useState<BannerForm>({
    linkUrl: '',
    isDirectLink: false,
    isAjl: false,
    secondLinkUrl: '',
    isAdLink: false,
    linkedAdId: null,
    linkedPremiumAdId: null,
    imageUrl: '',
    additionalImageUrl: '',
    isActive: true,
    isGlobal: false,
    selectedApartments: [],
    startDate: '',
    endDate: '',
    description: '',
  });

  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [resetClickDialogOpen, setResetClickDialogOpen] = useState(false);
  const [resetClickBanner, setResetClickBanner] = useState<Banner | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // 클릭수 컬럼 숨김 상태 (localStorage에서 읽어옴 - ads 페이지와 공유)
  const [hideClickCounts, setHideClickCounts] = useState(false);

  // localStorage에서 hideClickColumn 값 읽어오기
  useEffect(() => {
    const stored = localStorage.getItem('hideClickColumn');
    setHideClickCounts(stored === 'true');

    // 다른 탭에서 변경 시 동기화
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hideClickColumn') {
        setHideClickCounts(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 클릭수 숨김 토글 (ads 페이지와 같은 localStorage 키에 저장)
  const handleHideClickCountsChange = (checked: boolean): void => {
    setHideClickCounts(checked);
    try {
      localStorage.setItem('hideClickColumn', String(checked));
    } catch {
      // localStorage 접근 불가(시크릿 모드 등) 시 현재 화면 상태만 유지
    }
  };

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

  useEffect(() => {
    if (currentUserId) {
      loadBanners();
      fetchApartments();
    }
  }, [currentUserId, fetchApartments, isManager]);

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

      // 배너에 user 정보 추가
      const bannersWithInfo = (data || []).map(banner => ({
        ...banner,
        user: banner.createdBy ? usersMap[banner.createdBy] || null : null,
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

    setTogglingId(id);
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
    } finally {
      setTogglingId(null);
    }
  };

  const handleAddNew = () => {
    setEditingBanner(null);
    setApartmentSearch('');
    setLinkedAd(null);
    setForm({
      linkUrl: '',
      isDirectLink: false,
      isAjl: false,
      secondLinkUrl: '',
      isAdLink: false,
      linkedAdId: null,
      linkedPremiumAdId: null,
      imageUrl: '',
      additionalImageUrl: '',
      isActive: true,
      isGlobal: false,
      selectedApartments: [],
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
    setLinkedAd(null);
    setForm({
      linkUrl: banner.linkUrl || '',
      isDirectLink: banner.isDirectLink ?? false,
      isAjl: banner.bannerType === 'ajl',
      secondLinkUrl: banner.secondLinkUrl || '',
      isAdLink: banner.bannerType === 'ad',
      linkedAdId: banner.linkedAdId ?? null,
      linkedPremiumAdId: banner.linkedPremiumAdId ?? null,
      imageUrl: banner.imageUrl,
      additionalImageUrl: banner.additionalImageUrl || '',
      isActive: banner.isActive,
      isGlobal: banner.isGlobal,
      selectedApartments: selectedApts,
      startDate: banner.startDate ? banner.startDate.split('T')[0] : '',
      endDate: banner.endDate ? banner.endDate.split('T')[0] : '',
      description: banner.description || '',
    });
    setDialogOpen(true);
  };

  /**
   * 광고 연결 배너 검증 — 문제가 있으면 메시지, 없으면 null.
   * 노출 아파트는 저장 시점에 DB에서 다시 읽는다 (폼을 연 뒤 광고의 아파트가 바뀌었을 수 있다).
   */
  const validateAdLink = async (): Promise<string | null> => {
    if (!form.linkedAdId && !form.linkedPremiumAdId) {
      return '연결할 광고를 선택해주세요.';
    }
    if (form.isGlobal) {
      return '광고 연결 배너는 전체 대상으로 등록할 수 없습니다. 광고가 노출 중인 아파트를 선택해주세요.';
    }
    // 내린 배너는 연결 광고가 종료됐어도 저장할 수 있어야 한다
    if (!form.isActive) return null;
    if (!linkedAd) {
      return '연결된 광고가 노출 중이 아닙니다. 다른 광고를 연결하거나 배너를 비활성화해주세요.';
    }

    const baseAdId = form.linkedAdId ?? (await fetchPremiumBaseAdId(form.linkedPremiumAdId!));
    if (!baseAdId) return '연결한 프리미엄 광고의 기본 광고를 찾을 수 없습니다.';

    const { data: adApartments } = await supabase
      .from('advertisement_apartments_v2')
      .select('apartmentId')
      .eq('advertisementId', baseAdId);
    const exposed = new Set((adApartments ?? []).map((a: { apartmentId: string }) => a.apartmentId));
    const outside = form.selectedApartments.filter((aptId) => !exposed.has(aptId));
    if (outside.length > 0) {
      return `광고가 노출되지 않는 아파트 ${outside.length}곳이 선택되어 있습니다. 광고 노출 아파트 안에서만 선택해주세요.`;
    }
    return null;
  };

  const fetchPremiumBaseAdId = async (premiumAdId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('premium_advertisements_v2')
      .select('baseAdId')
      .eq('id', premiumAdId)
      .maybeSingle();
    return (data as { baseAdId: string | null } | null)?.baseAdId ?? null;
  };

  // 광고를 고르면 배너 대상 아파트에서 그 광고가 노출되지 않는 곳을 뺀다
  const handleSelectLinkedAd = (ad: LinkableAd | null) => {
    setLinkedAd(ad);
    if (!ad) return;
    setForm((prev) => ({
      ...prev,
      linkedAdId: ad.kind === 'base' ? ad.id : null,
      linkedPremiumAdId: ad.kind === 'premium' ? ad.id : null,
      selectedApartments: prev.selectedApartments.filter((aptId) => ad.apartmentIds.includes(aptId)),
    }));
  };

  // 광고 연결 배너는 연결 광고의 노출 아파트만 대상 후보로 보여준다
  const selectableApartments = form.isAdLink
    ? apartments.filter((apt) => linkedAd?.apartmentIds.includes(apt.id))
    : apartments;

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

      // 매니저는 isGlobal 사용 불가
      if (isManager && form.isGlobal) {
        toast.error('매니저는 전체 대상 배너를 등록할 수 없습니다.');
        return;
      }

      const linkUrl = form.linkUrl.trim() || null;
      const secondLinkUrl = form.secondLinkUrl.trim() || null;

      // 아정당 배너는 두 상담 링크가 모두 있어야 앱에서 선택지가 성립한다
      if (form.isAjl && (!linkUrl || !secondLinkUrl)) {
        toast.error('아정당 배너는 인터넷 가입 상담·가전 렌탈 상담 링크를 모두 입력해야 합니다.');
        return;
      }

      if (form.isAdLink) {
        const adLinkError = await validateAdLink();
        if (adLinkError) {
          toast.error(adLinkError);
          return;
        }
      }

      const bannerData = {
        imageUrl: form.imageUrl,
        additionalImageUrl: form.additionalImageUrl.trim() || null,
        linkUrl,
        // 아정당·광고 연결 배너는 앱이 자체 동작을 하므로 바로 이동 옵션과 함께 쓰지 않는다
        isDirectLink: linkUrl && !form.isAjl && !form.isAdLink ? form.isDirectLink : false,
        bannerType: form.isAjl ? 'ajl' : form.isAdLink ? 'ad' : 'normal',
        secondLinkUrl: form.isAjl ? secondLinkUrl : null,
        linkedAdId: form.isAdLink ? form.linkedAdId : null,
        linkedPremiumAdId: form.isAdLink ? form.linkedPremiumAdId : null,
        isActive: form.isActive,
        isGlobal: form.isGlobal,
        createdBy: editingBanner ? editingBanner.createdBy : currentUserId,
        startDate: form.isGlobal ? null : (form.startDate ? new Date(form.startDate + 'T00:00:00').toISOString() : null),
        endDate: form.isGlobal ? null : (form.endDate ? new Date(form.endDate + 'T23:59:59').toISOString() : null),
        description: form.description.trim() || null,
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

    if (!(await confirmModal({ title: '배너 삭제', message: '이 배너를 삭제하시겠습니까?', confirmLabel: '삭제', danger: true }))) {
      return;
    }

    try {
      // 배너 이미지 스토리지에서 삭제
      if (banner.imageUrl) {
        await deleteFileFromStorage(banner.imageUrl);
      }
      if (banner.additionalImageUrl) {
        await deleteFileFromStorage(banner.additionalImageUrl);
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

  // 클릭수 초기화
  const handleResetClickCount = async () => {
    if (!resetClickBanner) return;

    try {
      const { error } = await supabase
        .from('home_banners')
        .update({ clickCount: 0, adClickCount: 0 })
        .eq('id', resetClickBanner.id);

      if (error) throw error;

      toast.success('클릭수가 초기화되었습니다.');
      await loadBanners();
      setResetClickDialogOpen(false);
      setResetClickBanner(null);
    } catch (err) {
      console.error('Error resetting click count:', err);
      toast.error('클릭수 초기화에 실패했습니다.');
    }
  };

  const resetForm = () => {
    setForm({
      linkUrl: '',
      isDirectLink: false,
      isAjl: false,
      secondLinkUrl: '',
      isAdLink: false,
      linkedAdId: null,
      linkedPremiumAdId: null,
      imageUrl: '',
      additionalImageUrl: '',
      isActive: true,
      isGlobal: false,
      selectedApartments: [],
      startDate: '',
      endDate: '',
      description: '',
    });
    setEditingBanner(null);
    setApartmentSearch('');
    setLinkedAd(null);
  };

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="배너 등록/수정"
          description="홈 화면 상단 배너 광고를 관리합니다."
        />
      </PageHeader>

      <PageContent>
        {/* Info Alert */}
        <Alert variant="light" color="gray" icon={<AlertCircle size={16} />}>
          홈 화면 상단에 표시되는 배너 광고를 관리합니다. 최신 등록순으로 정렬됩니다.
        </Alert>

        {/* Banners List */}
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between" gap="sm">
              <Title order={4}>배너 목록</Title>
              <Group gap="md">
                <Checkbox
                  label="클릭수 숨기기"
                  checked={hideClickCounts}
                  onChange={(e) => handleHideClickCountsChange(e.currentTarget.checked)}
                />
                <Button onClick={handleAddNew} leftSection={<Plus size={16} />}>
                  새 배너
                </Button>
              </Group>
            </Group>
            {loading ? (
              <TableSkeleton rows={8} columns={hideClickCounts ? 8 : 10} />
            ) : banners.length === 0 ? (
              <Text c="dimmed" ta="center" py={48}>
                등록된 배너가 없습니다.
              </Text>
            ) : (
              <Table.ScrollContainer minWidth={720} type="native">
                <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={128}>이미지</Table.Th>
                      <Table.Th w={128}>링크 URL</Table.Th>
                      <Table.Th w={128}>타겟</Table.Th>
                      <Table.Th w={112}>게시 기간</Table.Th>
                      <Table.Th w={80}>등록자</Table.Th>
                      <Table.Th w={128}>소개내용</Table.Th>
                      {!hideClickCounts && (
                        <>
                          <Table.Th w={96}>광고클릭수</Table.Th>
                          <Table.Th w={80}>클릭수</Table.Th>
                        </>
                      )}
                      <Table.Th w={80}>활성화</Table.Th>
                      <Table.Th w={96}>작업</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {banners.map((banner) => (
                      <BannerRow
                        key={banner.id}
                        banner={banner}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleActive={handleToggleActive}
                        onResetClick={(b) => {
                          setResetClickBanner(b);
                          setResetClickDialogOpen(true);
                        }}
                        canEdit={canEditBanner(banner)}
                        canDelete={canDeleteBanner(banner)}
                        hideClickCounts={hideClickCounts}
                        toggling={togglingId === banner.id}
                      />
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>
        </Paper>

        {/* Add/Edit Dialog */}
        <Modal
          opened={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={editingBanner ? '배너 수정' : '새 배너 등록'}
          size={896}
        >
          <Stack gap="lg">
            {/* Image Upload */}
            <Input.Wrapper label="배너 이미지" withAsterisk>
              <ImageUpload
                bucket={BUCKET_NAME}
                storagePath={BANNERS_FOLDER}
                value={form.imageUrl}
                onChange={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
                accept="image/*"
                maxSizeMB={5}
                description="배너 이미지를 업로드하세요 (권장: 가로형 이미지)"
              />
            </Input.Wrapper>

            {/* Additional Image Upload */}
            <Input.Wrapper
              label={
                <>
                  추가 이미지{' '}
                  <Text span c="dimmed" inherit>
                    (선택사항)
                  </Text>
                </>
              }
            >
              <ImageUpload
                bucket={BUCKET_NAME}
                storagePath={BANNERS_FOLDER}
                value={form.additionalImageUrl}
                onChange={(url) => setForm((prev) => ({ ...prev, additionalImageUrl: url }))}
                accept="image/*"
                maxSizeMB={5}
                description="배너와 함께 표시할 추가 이미지를 업로드하세요"
              />
            </Input.Wrapper>

            {/* Link URL */}
            <TextInput
              id="linkUrl"
              type="url"
              label={
                <>
                  링크 URL{' '}
                  <Text span c="dimmed" inherit>
                    (선택사항)
                  </Text>
                </>
              }
              value={form.linkUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
              placeholder="https://example.com"
              description="배너 클릭 시 이동할 URL을 입력하세요."
              inputWrapperOrder={['label', 'input', 'description']}
            />

            {/* 아정당 배너 — 탭하면 앱이 인터넷 가입 상담 / 가전 렌탈 상담 중 하나를 고르게 하고 인앱 웹뷰로 연다 */}
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" wrap="nowrap" gap="md">
                <Stack gap={4}>
                  <Text component="label" htmlFor="isAjl" size="sm" fw={500}>
                    아정당 배너
                  </Text>
                  <Text size="xs" c="dimmed">
                    활성화하면 링크 URL은 인터넷 가입 상담, 아래 두 번째 링크는 가전 렌탈 상담으로 쓰입니다.
                  </Text>
                </Stack>
                <Switch
                  id="isAjl"
                  checked={form.isAjl}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setForm((prev) => ({
                      ...prev,
                      isAjl: checked,
                      isDirectLink: checked ? false : prev.isDirectLink,
                      isAdLink: checked ? false : prev.isAdLink,
                    }));
                  }}
                />
              </Group>
            </Paper>

            {form.isAjl && (
              <TextInput
                id="secondLinkUrl"
                type="url"
                label="가전 렌탈 상담 링크 URL"
                value={form.secondLinkUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, secondLinkUrl: e.target.value }))}
                placeholder="https://biz.ajl.to/lead/rental?companyId=..."
              />
            )}

            {/* 광고 연결 배너 — 탭하면 앱이 연결된 광고 상세로 바로 이동한다. 대상 아파트는 광고 노출 아파트 안에서만 */}
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" wrap="nowrap" gap="md">
                <Stack gap={4}>
                  <Text component="label" htmlFor="isAdLink" size="sm" fw={500}>
                    광고 연결 배너
                  </Text>
                  <Text size="xs" c="dimmed">
                    활성화하면 배너를 눌렀을 때 연결한 광고의 상세 화면으로 바로 이동합니다. 전체 대상으로는 쓸 수 없습니다.
                  </Text>
                </Stack>
                <Switch
                  id="isAdLink"
                  checked={form.isAdLink}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setForm((prev) => ({
                      ...prev,
                      isAdLink: checked,
                      isAjl: checked ? false : prev.isAjl,
                      isDirectLink: checked ? false : prev.isDirectLink,
                      isGlobal: checked ? false : prev.isGlobal,
                    }));
                  }}
                />
              </Group>
            </Paper>

            {form.isAdLink && (
              <Input.Wrapper label="연결할 광고" withAsterisk>
                <LinkedAdPicker
                  value={{ linkedAdId: form.linkedAdId, linkedPremiumAdId: form.linkedPremiumAdId }}
                  onChange={handleSelectLinkedAd}
                />
              </Input.Wrapper>
            )}

            {/* isDirectLink Switch - 링크 URL이 있을 때만 의미 있음. 아정당 배너는 자체 선택 화면이 있어 사용 불가 */}
            <Paper withBorder radius="md" p="md">
              <Group justify="space-between" wrap="nowrap" gap="md">
                <Stack gap={4}>
                  <Text component="label" htmlFor="isDirectLink" size="sm" fw={500}>
                    링크로 바로 이동
                  </Text>
                  <Text size="xs" c="dimmed">
                    활성화하면 배너 상세 화면 없이 링크 URL이 바로 열립니다.
                  </Text>
                </Stack>
                <Switch
                  id="isDirectLink"
                  checked={form.isDirectLink}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setForm((prev) => ({ ...prev, isDirectLink: checked }));
                  }}
                  disabled={!form.linkUrl.trim() || form.isAjl || form.isAdLink}
                />
              </Group>
            </Paper>

            {/* isGlobal Switch - 매니저·광고 연결 배너는 사용 불가 */}
            {isSuperAdmin && !form.isAdLink && (
              <Paper withBorder radius="md" p="md">
                <Group justify="space-between" wrap="nowrap" gap="md">
                  <Stack gap={4}>
                    <Text
                      component="label"
                      htmlFor="isGlobal"
                      size="sm"
                      fw={500}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <Globe size={16} />
                      전체 대상
                    </Text>
                    <Text size="xs" c="dimmed">
                      활성화하면 모든 회원에게 배너가 표시됩니다.
                    </Text>
                  </Stack>
                  <Switch
                    id="isGlobal"
                    checked={form.isGlobal}
                    onChange={(e) => {
                      const checked = e.currentTarget.checked;
                      setForm((prev) => ({
                        ...prev,
                        isGlobal: checked,
                        selectedApartments: checked ? [] : prev.selectedApartments,
                      }));
                    }}
                  />
                </Group>
              </Paper>
            )}

            {/* 게시 기간 - isGlobal이 false인 경우에만 표시 */}
            {!form.isGlobal && (
              <Input.Wrapper
                label={
                  <Group gap="xs" component="span" display="inline-flex">
                    <Calendar size={16} />
                    게시 기간
                  </Group>
                }
                withAsterisk
              >
                <Stack gap="xs">
                  <SimpleGrid cols={2} spacing="sm">
                    <TextInput
                      id="startDate"
                      type="date"
                      label="시작일"
                      size="sm"
                      styles={{ label: { fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-dimmed)', fontWeight: 500 } }}
                      value={form.startDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                    />
                    <TextInput
                      id="endDate"
                      type="date"
                      label="종료일"
                      size="sm"
                      styles={{ label: { fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-dimmed)', fontWeight: 500 } }}
                      value={form.endDate}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, endDate: e.target.value }))
                      }
                    />
                  </SimpleGrid>
                  <Group gap="xs">
                    {[
                      { days: 14, label: '14일' },
                      { days: 30, label: '1개월' },
                      { days: 180, label: '6개월' },
                      { days: 365, label: '12개월' },
                    ].map(({ days, label }) => (
                      <Button
                        key={days}
                        type="button"
                        variant="default"
                        size="xs"
                        onClick={() => {
                          const today = new Date();
                          const endDate = new Date();
                          endDate.setDate(today.getDate() + days);
                          setForm({
                            ...form,
                            startDate: format(today, 'yyyy-MM-dd'),
                            endDate: format(endDate, 'yyyy-MM-dd'),
                          });
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              </Input.Wrapper>
            )}

            {/* 소개내용 */}
            <Textarea
              id="description"
              label={
                <>
                  소개내용
                  {!form.isGlobal && (
                    <Text span c="red" inherit>
                      {' '}*
                    </Text>
                  )}
                  {form.isGlobal && (
                    <Text span c="dimmed" inherit>
                      {' '}(선택사항)
                    </Text>
                  )}
                </>
              }
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="배너 소개내용을 입력하세요"
              rows={3}
            />

            {/* 아파트 선택 - isGlobal이 false인 경우에만 표시 */}
            {!form.isGlobal && (
              <Stack gap="xs">
                <Group justify="space-between" wrap="nowrap">
                  <Input.Label required>타겟 아파트 선택</Input.Label>
                  <Group gap={4}>
                    <Button
                      type="button"
                      variant="subtle"
                      size="xs"
                      onClick={() => setForm({ ...form, selectedApartments: selectableApartments.map(a => a.id) })}
                    >
                      전체 선택
                    </Button>
                    <Button
                      type="button"
                      variant="subtle"
                      color="gray"
                      size="xs"
                      onClick={() => setForm({ ...form, selectedApartments: [] })}
                    >
                      전체 해제
                    </Button>
                  </Group>
                </Group>

                {/* 아파트 검색 및 체크박스 목록 */}
                <Paper withBorder radius="md">
                  {/* 검색 입력 */}
                  <Box p="xs" style={{ borderBottom: '1px solid var(--app-divider)' }}>
                    <TextInput
                      placeholder="아파트명 또는 주소 검색..."
                      value={apartmentSearch}
                      onChange={(e) => setApartmentSearch(e.target.value)}
                      leftSection={<Search size={16} />}
                    />
                  </Box>
                  <ScrollArea h={200}>
                    <Stack gap={4} p="xs">
                      {(() => {
                        const filteredApartments = selectableApartments.filter(apt =>
                          apt.name.toLowerCase().includes(apartmentSearch.toLowerCase()) ||
                          apt.address.toLowerCase().includes(apartmentSearch.toLowerCase())
                        );

                        if (selectableApartments.length === 0) {
                          return (
                            <Text size="sm" c="dimmed" ta="center" py="md">
                              {form.isAdLink ? '먼저 연결할 광고를 선택해주세요.' : '선택 가능한 아파트가 없습니다.'}
                            </Text>
                          );
                        }

                        if (filteredApartments.length === 0) {
                          return (
                            <Text size="sm" c="dimmed" ta="center" py="md">
                              검색 결과가 없습니다.
                            </Text>
                          );
                        }

                        return filteredApartments.map((apt) => (
                          <Group
                            key={apt.id}
                            gap="sm"
                            wrap="nowrap"
                            p="xs"
                            style={{ cursor: 'pointer', borderRadius: 'var(--mantine-radius-sm)' }}
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
                              onChange={(e) => {
                                const checked = e.currentTarget.checked;
                                setForm({
                                  ...form,
                                  selectedApartments: checked
                                    ? [...form.selectedApartments, apt.id]
                                    : form.selectedApartments.filter(id => id !== apt.id)
                                });
                              }}
                            />
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                component="label"
                                htmlFor={`apt-${apt.id}`}
                                size="sm"
                                fw={500}
                                display="block"
                                style={{ cursor: 'pointer' }}
                              >
                                {apt.name}
                              </Text>
                              <Text size="xs" c="dimmed" truncate>
                                {apt.address}
                              </Text>
                            </Box>
                          </Group>
                        ));
                      })()}
                    </Stack>
                  </ScrollArea>
                </Paper>

                <Text size="xs" c="dimmed">
                  선택된 아파트: {form.selectedApartments.length}개 / 전체 {apartments.length}개
                </Text>

                {/* 선택된 아파트 뱃지 */}
                {form.selectedApartments.length > 0 && (
                  <Group gap="xs" pt="xs">
                    {form.selectedApartments.map((aptId) => {
                      const apt = apartments.find((a) => a.id === aptId);
                      return apt ? (
                        <Badge
                          key={aptId}
                          variant="light"
                          color="gray"
                          tt="none"
                          pr={4}
                          rightSection={
                            <CloseButton
                              size="xs"
                              variant="transparent"
                              aria-label={`${apt.name} 제거`}
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
                            />
                          }
                        >
                          {apt.name}
                        </Badge>
                      ) : null;
                    })}
                  </Group>
                )}
              </Stack>
            )}

            {/* Active Status */}
            <Group justify="space-between" wrap="nowrap">
              <Text component="label" htmlFor="isActive" size="sm" fw={500}>
                활성화
              </Text>
              <Switch
                id="isActive"
                checked={form.isActive}
                onChange={(e) => {
                  const checked = e.currentTarget.checked;
                  setForm((prev) => ({ ...prev, isActive: checked }));
                }}
              />
            </Group>
          </Stack>

          <Group justify="flex-end" mt="lg">
            <Button
              variant="default"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
              disabled={saving}
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.imageUrl || (!form.isGlobal && !form.description.trim())}
              leftSection={
                saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />
              }
            >
              {saving ? '저장 중...' : '저장'}
            </Button>
          </Group>
        </Modal>

        {/* 클릭수 초기화 확인 다이얼로그 */}
        <Modal
          opened={resetClickDialogOpen}
          onClose={() => setResetClickDialogOpen(false)}
          title={
            <Group component="span" gap="xs" display="inline-flex">
              <AlertCircle size={20} color="var(--mantine-color-blue-filled)" />
              클릭수 초기화
            </Group>
          }
        >
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              이 배너의 클릭수를 0으로 초기화하시겠습니까?
            </Text>
            <Text size="sm" c="blue">
              현재: 광고 클릭수 {resetClickBanner?.adClickCount?.toLocaleString() || '0'} / 클릭 수 {resetClickBanner?.clickCount?.toLocaleString() || '0'}
            </Text>
          </Stack>
          <Group justify="flex-end" mt="lg">
            <Button
              variant="default"
              onClick={() => {
                setResetClickDialogOpen(false);
                setResetClickBanner(null);
              }}
            >
              취소
            </Button>
            <Button color="blue" onClick={handleResetClickCount}>
              초기화
            </Button>
          </Group>
        </Modal>
      </PageContent>
    </PageShell>
  );
}
