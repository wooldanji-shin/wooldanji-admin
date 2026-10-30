'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { PageContent, PageShell } from '@/components/page-shell';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/skeletons';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Input,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Building2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { ImageUpload } from '@/components/image-upload';
import { deleteFileFromStorage } from '@/lib/utils/storage';
import {
  formatPhoneNumber,
  formatLandlineNumber,
  formatBusinessRegistrationNumber,
} from '@/lib/utils/format';

const BUCKET_NAME = 'advertisements';
const STORAGE_PATH = 'advertisers';

interface Advertiser {
  id: string;
  businessName: string;
  representativeName: string;
  contactPhoneNumber: string;
  displayPhoneNumber: string | null;
  email: string | null;
  address: string;
  businessRegistrationNumber: string | null;
  businessRegistration: string | null;
  contractDocument: string | null;
  contractMemo: string | null;
  searchTags: string[];
  createdBy: string | null;
  createdAt: string;
  // 조인 데이터
  bannerCount?: number;
  adCount?: number;
  // 광고 카테고리 (1:1 매칭)
  categoryId?: string | null;
  categoryName?: string | null;
  // 등록자 정보
  creatorName?: string | null;
}

interface Category {
  id: string;
  categoryName: string;
}

interface AdvertiserForm {
  businessName: string;
  representativeName: string;
  contactPhoneNumber: string;
  displayPhoneNumber: string;
  email: string;
  address: string;
  categoryId: string;
  businessRegistrationNumber: string;
  businessRegistration: string;
  contractDocument: string;
  contractMemo: string;
}

const initialFormState: AdvertiserForm = {
  businessName: '',
  representativeName: '',
  contactPhoneNumber: '',
  displayPhoneNumber: '',
  email: '',
  address: '',
  categoryId: '',
  businessRegistrationNumber: '',
  businessRegistration: '',
  contractDocument: '',
  contractMemo: '',
};

export default function AdvertisersPage() {
  const supabase = createClient();

  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCreator, setFilterCreator] = useState<string>('all');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAdvertiser, setEditingAdvertiser] = useState<Advertiser | null>(null);
  const [form, setForm] = useState<AdvertiserForm>(initialFormState);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [advertiserToDelete, setAdvertiserToDelete] = useState<Advertiser | null>(null);

  // 계약메모 인라인 편집
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoValue, setEditingMemoValue] = useState('');

  // 유저 정보 로드
  useEffect(() => {
    const loadUserInfo = async () => {
      const user = await getCurrentUser();
      const roles = await getUserRoles();
      setCurrentUserId(user?.id || null);
      setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
    };
    loadUserInfo();
  }, []);

  // 광고주 목록 로드
  const loadAdvertisers = useCallback(async () => {
    try {
      setLoading(true);

      // 카테고리 목록 로드 (비활성화된 카테고리도 포함)
      const { data: categoriesData } = await supabase
        .from('ad_categories')
        .select('id, categoryName')
        .order('categoryName');

      setCategories(categoriesData || []);

      // 광고주 기본 정보 조회
      let query = supabase
        .from('advertisers')
        .select('*')
        .order('createdAt', { ascending: false });

      // 매니저는 자신이 등록한 것만
      if (!isSuperAdmin && currentUserId) {
        query = query.eq('createdBy', currentUserId);
      }

      const { data: advertisersData, error } = await query;

      if (error) throw error;

      // 배너/광고 카운트, 카테고리, 등록자 정보 조회
      const advertiserIds = (advertisersData || []).map((a) => a.id);
      const creatorIds = [...new Set((advertisersData || []).map((a) => a.createdBy).filter(Boolean))] as string[];

      if (advertiserIds.length > 0) {
        // 배너 카운트
        const { data: bannerCounts } = await supabase
          .from('home_banners')
          .select('advertiserId')
          .in('advertiserId', advertiserIds);

        // 광고 정보 (카테고리 포함)
        const { data: adsData } = await supabase
          .from('advertisements')
          .select('advertiserId, categoryId, ad_categories(categoryName)')
          .in('advertiserId', advertiserIds);

        // 등록자 정보
        const creatorMap: Record<string, string> = {};
        if (creatorIds.length > 0) {
          const { data: usersData } = await supabase
            .from('user')
            .select('id, name')
            .in('id', creatorIds);

          (usersData || []).forEach((u: { id: string; name: string }) => {
            creatorMap[u.id] = u.name;
          });
        }

        // 카운트 매핑
        const bannerCountMap: Record<string, number> = {};
        const adCountMap: Record<string, number> = {};

        (bannerCounts || []).forEach((b) => {
          bannerCountMap[b.advertiserId] = (bannerCountMap[b.advertiserId] || 0) + 1;
        });

        (adsData || []).forEach((a: { advertiserId: string; categoryId: string | null; ad_categories: { categoryName: string } | null }) => {
          adCountMap[a.advertiserId] = (adCountMap[a.advertiserId] || 0) + 1;
        });

        // 카테고리 이름 매핑
        const categoryNameMap: Record<string, string> = {};
        (categoriesData || []).forEach((cat) => {
          categoryNameMap[cat.id] = cat.categoryName;
        });

        const advertisersWithCounts = (advertisersData || []).map((advertiser) => ({
          ...advertiser,
          bannerCount: bannerCountMap[advertiser.id] || 0,
          adCount: adCountMap[advertiser.id] || 0,
          categoryName: advertiser.categoryId ? categoryNameMap[advertiser.categoryId] || null : null,
          creatorName: advertiser.createdBy ? creatorMap[advertiser.createdBy] || null : null,
        }));

        setAdvertisers(advertisersWithCounts);
      } else {
        setAdvertisers([]);
      }
    } catch (err) {
      console.error('Error loading advertisers:', err);
      toast.error('광고주 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase, currentUserId, isSuperAdmin]);

  useEffect(() => {
    if (currentUserId !== null) {
      loadAdvertisers();
    }
  }, [currentUserId, loadAdvertisers]);

  // 등록자 목록 (필터용)
  const creators = useMemo(() => {
    const creatorMap = new Map<string, string>();
    advertisers.forEach((a) => {
      if (a.createdBy && a.creatorName) {
        creatorMap.set(a.createdBy, a.creatorName);
      }
    });
    return Array.from(creatorMap, ([id, name]) => ({ id, name }));
  }, [advertisers]);

  // 검색 및 필터
  const filteredAdvertisers = advertisers.filter((a) => {
    // 검색어 필터
    const matchesSearch =
      a.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.representativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.address.toLowerCase().includes(searchQuery.toLowerCase());

    // 카테고리 필터
    const matchesCategory =
      filterCategory === 'all' ||
      (filterCategory === 'uncategorized' && !a.categoryId) ||
      a.categoryId === filterCategory;

    // 유형 필터 (배너/광고)
    const hasBanner = (a.bannerCount || 0) > 0;
    const hasAd = (a.adCount || 0) > 0;
    const matchesType =
      filterType === 'all' ||
      (filterType === 'banner' && hasBanner) ||
      (filterType === 'ad' && hasAd) ||
      (filterType === 'none' && !hasBanner && !hasAd);

    // 등록자 필터
    const matchesCreator =
      filterCreator === 'all' || a.createdBy === filterCreator;

    return matchesSearch && matchesCategory && matchesType && matchesCreator;
  });

  // 카테고리별로 광고주 그룹화
  const groupedAdvertisersByCategory = useMemo(() => {
    const grouped: Record<string, { categoryName: string; advertisers: Advertiser[] }> = {};

    filteredAdvertisers.forEach((advertiser) => {
      const categoryKey = advertiser.categoryId || 'uncategorized';
      const categoryName = advertiser.categoryName || '미분류';

      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {
          categoryName,
          advertisers: [],
        };
      }
      grouped[categoryKey].advertisers.push(advertiser);
    });

    return grouped;
  }, [filteredAdvertisers]);

  // 유형 뱃지 렌더링
  const renderTypeBadge = (advertiser: Advertiser) => {
    const hasBanner = (advertiser.bannerCount || 0) > 0;
    const hasAd = (advertiser.adCount || 0) > 0;

    if (hasBanner && hasAd) {
      return (
        <Group gap={4} wrap='nowrap'>
          <Badge variant='light' color='blue'>
            배너
          </Badge>
          <Badge variant='light' color='grape'>
            광고
          </Badge>
        </Group>
      );
    } else if (hasBanner) {
      return (
        <Badge variant='light' color='blue'>
          배너
        </Badge>
      );
    } else if (hasAd) {
      return (
        <Badge variant='light' color='grape'>
          광고
        </Badge>
      );
    } else {
      return <Text component='span' size='sm' c='dimmed'>-</Text>;
    }
  };

  // 다이얼로그 열기 (추가)
  const handleAdd = () => {
    setEditingAdvertiser(null);
    setForm(initialFormState);
    setDialogOpen(true);
  };

  // 다이얼로그 열기 (수정)
  const handleEdit = (advertiser: Advertiser) => {
    setEditingAdvertiser(advertiser);
    setForm({
      businessName: advertiser.businessName,
      representativeName: advertiser.representativeName,
      contactPhoneNumber: advertiser.contactPhoneNumber,
      displayPhoneNumber: advertiser.displayPhoneNumber || '',
      email: advertiser.email || '',
      address: advertiser.address,
      categoryId: advertiser.categoryId || '',
      businessRegistrationNumber: advertiser.businessRegistrationNumber || '',
      businessRegistration: advertiser.businessRegistration || '',
      contractDocument: advertiser.contractDocument || '',
      contractMemo: advertiser.contractMemo || '',
    });
    setDialogOpen(true);
  };

  // 저장
  const handleSave = async () => {
    try {
      setSaving(true);

      if (!form.businessName.trim()) {
        toast.error('상호명을 입력해주세요.');
        return;
      }
      if (!form.representativeName.trim()) {
        toast.error('대표자명을 입력해주세요.');
        return;
      }
      if (!form.contactPhoneNumber.trim()) {
        toast.error('연락처를 입력해주세요.');
        return;
      }
      if (!form.address.trim()) {
        toast.error('주소를 입력해주세요.');
        return;
      }

      const data = {
        businessName: form.businessName.trim(),
        representativeName: form.representativeName.trim(),
        contactPhoneNumber: form.contactPhoneNumber.trim(),
        displayPhoneNumber: form.displayPhoneNumber.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim(),
        categoryId: form.categoryId || null,
        businessRegistrationNumber: form.businessRegistrationNumber.trim() || null,
        businessRegistration: form.businessRegistration || null,
        contractDocument: form.contractDocument || null,
        contractMemo: form.contractMemo.trim() || null,
      };

      if (editingAdvertiser) {
        const { error } = await supabase
          .from('advertisers')
          .update(data)
          .eq('id', editingAdvertiser.id);

        if (error) throw error;
        toast.success('광고주가 수정되었습니다.');
      } else {
        const { error } = await supabase.from('advertisers').insert({
          ...data,
          createdBy: currentUserId,
        });

        if (error) throw error;
        toast.success('광고주가 등록되었습니다.');
      }

      setDialogOpen(false);
      setForm(initialFormState);
      setEditingAdvertiser(null);
      await loadAdvertisers();
    } catch (err) {
      console.error('Error saving advertiser:', err);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 삭제 확인
  const handleDeleteClick = (advertiser: Advertiser) => {
    setAdvertiserToDelete(advertiser);
    setDeleteDialogOpen(true);
  };

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!advertiserToDelete) return;

    try {
      // 파일 삭제
      if (advertiserToDelete.businessRegistration) {
        await deleteFileFromStorage(advertiserToDelete.businessRegistration);
      }
      if (advertiserToDelete.contractDocument) {
        await deleteFileFromStorage(advertiserToDelete.contractDocument);
      }

      // 광고주 삭제
      const { error } = await supabase
        .from('advertisers')
        .delete()
        .eq('id', advertiserToDelete.id);

      if (error) throw error;

      toast.success('광고주가 삭제되었습니다.');
      setDeleteDialogOpen(false);
      setAdvertiserToDelete(null);
      await loadAdvertisers();
    } catch (err) {
      console.error('Error deleting advertiser:', err);
      toast.error('삭제에 실패했습니다.');
    }
  };

  // 계약메모 저장
  const handleSaveMemo = async (advertiserId: string) => {
    try {
      const { error } = await supabase
        .from('advertisers')
        .update({ contractMemo: editingMemoValue.trim() || null })
        .eq('id', advertiserId);

      if (error) throw error;

      setAdvertisers((prev) =>
        prev.map((a) =>
          a.id === advertiserId ? { ...a, contractMemo: editingMemoValue.trim() || null } : a
        )
      );
      setEditingMemoId(null);
      setEditingMemoValue('');
      toast.success('계약메모가 저장되었습니다.');
    } catch (err) {
      console.error('Error saving memo:', err);
      toast.error('계약메모 저장에 실패했습니다.');
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <PageShell>
      <AdminHeader title='광고주 관리' />

      <PageContent>
        {/* 헤더 카드 */}
        <Paper withBorder radius='md' p={{ base: 'md', sm: 'lg' }} className='app-filter-card'>
          <Stack gap='md'>
            <Group justify='space-between' align='center'>
              <Group gap='xs'>
                <Building2 size={20} />
                <Title order={4}>광고주 목록</Title>
              </Group>
              <Button leftSection={<Plus size={16} />} onClick={handleAdd}>
                광고주 등록
              </Button>
            </Group>
            {/* 검색 */}
            <TextInput
              placeholder='상호명, 대표자명, 주소 검색...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<Search size={16} />}
              w='100%'
            />
            {/* 필터 */}
            <Group gap='xs'>
              <Select
                w={150}
                placeholder='카테고리'
                data={[
                  { value: 'all', label: '전체 카테고리' },
                  ...categories.map((cat) => ({ value: cat.id, label: cat.categoryName })),
                  { value: 'uncategorized', label: '미분류' },
                ]}
                value={filterCategory}
                onChange={(v) => {
                  if (v === null) return;
                  setFilterCategory(v);
                }}
                allowDeselect={false}
              />
              <Select
                w={130}
                placeholder='유형'
                data={[
                  { value: 'all', label: '전체 유형' },
                  { value: 'banner', label: '배너' },
                  { value: 'ad', label: '광고' },
                  { value: 'none', label: '없음' },
                ]}
                value={filterType}
                onChange={(v) => {
                  if (v === null) return;
                  setFilterType(v);
                }}
                allowDeselect={false}
              />
              <Select
                w={130}
                placeholder='등록자'
                data={[
                  { value: 'all', label: '전체 등록자' },
                  ...creators.map((creator) => ({ value: creator.id, label: creator.name })),
                ]}
                value={filterCreator}
                onChange={(v) => {
                  if (v === null) return;
                  setFilterCreator(v);
                }}
                allowDeselect={false}
              />
            </Group>
          </Stack>
        </Paper>

        {/* 광고주 목록 - 카테고리별로 분리 */}
        {loading ? (
          <Paper withBorder radius='md' style={{ overflow: 'hidden' }}>
            <TableSkeleton rows={8} columns={10} />
          </Paper>
        ) : Object.keys(groupedAdvertisersByCategory).length === 0 ? (
          <Paper withBorder radius='md'>
            <EmptyState
              icon={Building2}
              title='광고주가 없습니다'
              description={
                searchQuery
                  ? '검색 조건에 맞는 광고주가 없습니다. 다른 조건으로 시도해보세요.'
                  : '새로운 광고주를 등록하여 시작하세요.'
              }
              action={
                !searchQuery && (
                  <Button onClick={handleAdd} size='md' leftSection={<Plus size={18} />}>
                    첫 광고주 등록하기
                  </Button>
                )
              }
            />
          </Paper>
        ) : (
          Object.entries(groupedAdvertisersByCategory).map(([categoryId, { categoryName, advertisers: categoryAdvertisers }]) => (
            <Paper key={categoryId} withBorder radius='md' p='lg'>
              <Group gap='xs' mb='md'>
                <Title order={4}>{categoryName}</Title>
                <Badge variant='light' color='gray'>
                  {categoryAdvertisers.length}개
                </Badge>
              </Group>
              <Paper withBorder radius='md' style={{ overflow: 'hidden' }}>
                <Table.ScrollContainer minWidth={0} type='native'>
                  <Table highlightOnHover verticalSpacing='sm' horizontalSpacing='md'>
                    <Table.Thead bg='var(--app-bg-muted)'>
                      <Table.Tr>
                        <Table.Th w={180}>상호명</Table.Th>
                        <Table.Th w={120}>대표자명</Table.Th>
                        <Table.Th w={140}>연락처</Table.Th>
                        <Table.Th w={140}>표시 연락처</Table.Th>
                        <Table.Th>주소</Table.Th>
                        <Table.Th w={100}>유형</Table.Th>
                        <Table.Th w={200}>계약메모</Table.Th>
                        <Table.Th w={80}>등록자</Table.Th>
                        <Table.Th w={100}>등록일</Table.Th>
                        <Table.Th w={100}>작업</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {categoryAdvertisers.map((advertiser) => (
                        <Table.Tr key={advertiser.id}>
                          <Table.Td fw={500}>
                            {advertiser.businessName}
                          </Table.Td>
                          <Table.Td>{advertiser.representativeName}</Table.Td>
                          <Table.Td>{advertiser.contactPhoneNumber}</Table.Td>
                          <Table.Td>{advertiser.displayPhoneNumber || '-'}</Table.Td>
                          <Table.Td>
                            <Text size='sm' maw={200} truncate title={advertiser.address}>
                              {advertiser.address}
                            </Text>
                          </Table.Td>
                          <Table.Td>{renderTypeBadge(advertiser)}</Table.Td>
                          <Table.Td>
                            {editingMemoId === advertiser.id ? (
                              <Stack gap='xs'>
                                <Textarea
                                  value={editingMemoValue}
                                  onChange={(e) => setEditingMemoValue(e.target.value)}
                                  placeholder='계약메모 입력...'
                                  rows={3}
                                  size='sm'
                                  autoFocus
                                />
                                <Group gap={4}>
                                  <Button
                                    size='xs'
                                    onClick={() => handleSaveMemo(advertiser.id)}
                                  >
                                    저장
                                  </Button>
                                  <Button
                                    size='xs'
                                    variant='default'
                                    onClick={() => {
                                      setEditingMemoId(null);
                                      setEditingMemoValue('');
                                    }}
                                  >
                                    취소
                                  </Button>
                                </Group>
                              </Stack>
                            ) : (
                              <UnstyledButton
                                w='100%'
                                mih={32}
                                p={4}
                                style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                                onClick={() => {
                                  setEditingMemoId(advertiser.id);
                                  setEditingMemoValue(advertiser.contractMemo || '');
                                }}
                              >
                                {advertiser.contractMemo ? (
                                  <Text size='sm' lineClamp={2} style={{ whiteSpace: 'pre-wrap' }}>{advertiser.contractMemo}</Text>
                                ) : (
                                  <Text size='sm' c='dimmed'>클릭하여 입력</Text>
                                )}
                              </UnstyledButton>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {advertiser.creatorName || '-'}
                          </Table.Td>
                          <Table.Td c='dimmed'>
                            {formatDate(advertiser.createdAt)}
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4} wrap='nowrap'>
                              <ActionIcon
                                variant='subtle'
                                color='gray'
                                aria-label='수정'
                                onClick={() => handleEdit(advertiser)}
                              >
                                <Edit size={16} />
                              </ActionIcon>
                              <Tooltip
                                label='배너나 광고가 연결된 광고주는 삭제할 수 없습니다'
                                disabled={
                                  !(
                                    (advertiser.bannerCount || 0) > 0 ||
                                    (advertiser.adCount || 0) > 0
                                  )
                                }
                              >
                                <span style={{ display: 'inline-flex' }}>
                                  <ActionIcon
                                    variant='subtle'
                                    color='red'
                                    aria-label='삭제'
                                    onClick={() => handleDeleteClick(advertiser)}
                                    disabled={
                                      (advertiser.bannerCount || 0) > 0 ||
                                      (advertiser.adCount || 0) > 0
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </ActionIcon>
                                </span>
                              </Tooltip>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Paper>
            </Paper>
          ))
        )}
      </PageContent>

      {/* 등록/수정 다이얼로그 */}
      <Modal
        opened={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingAdvertiser ? '광고주 수정' : '광고주 등록'}
        size='xl'
      >
        <Stack gap='md'>
          {/* Row 1: 상호명, 대표자명 */}
          <SimpleGrid cols={2} spacing='md'>
            <TextInput
              id='businessName'
              label='상호명'
              withAsterisk
              value={form.businessName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, businessName: e.target.value }))
              }
              placeholder='상호명 입력'
            />
            <TextInput
              id='representativeName'
              label='대표자명'
              withAsterisk
              value={form.representativeName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, representativeName: e.target.value }))
              }
              placeholder='대표자명 입력'
            />
          </SimpleGrid>

          {/* Row 2: 카테고리, 사업자등록번호 */}
          <SimpleGrid cols={2} spacing='md'>
            <Select
              id='categoryId'
              label='카테고리'
              placeholder='카테고리를 선택하세요'
              data={categories.map((cat) => ({ value: cat.id, label: cat.categoryName }))}
              value={form.categoryId || null}
              onChange={(value) => {
                if (value === null) return;
                setForm((prev) => ({ ...prev, categoryId: value }));
              }}
              allowDeselect={false}
            />
            <TextInput
              id='businessRegistrationNumber'
              label='사업자등록번호'
              value={form.businessRegistrationNumber}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  businessRegistrationNumber: formatBusinessRegistrationNumber(e.target.value),
                }))
              }
              placeholder='000-00-000000'
              maxLength={13}
            />
          </SimpleGrid>

          {/* Row 3: 연락처, 표시 연락처 */}
          <SimpleGrid cols={2} spacing='md'>
            <TextInput
              id='contactPhoneNumber'
              label='연락처'
              withAsterisk
              value={form.contactPhoneNumber}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  contactPhoneNumber: formatPhoneNumber(e.target.value),
                }))
              }
              placeholder='010-0000-0000'
              maxLength={13}
            />
            <TextInput
              id='displayPhoneNumber'
              label='표시 연락처'
              value={form.displayPhoneNumber}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  displayPhoneNumber: formatLandlineNumber(e.target.value),
                }))
              }
              placeholder='02-123-1234 / 031-123-1234'
              maxLength={13}
            />
          </SimpleGrid>

          {/* Row 4: 이메일, 주소 */}
          <SimpleGrid cols={2} spacing='md'>
            <TextInput
              id='email'
              label='이메일'
              type='email'
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder='email@example.com'
            />
            <TextInput
              id='address'
              label='주소'
              withAsterisk
              value={form.address}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder='주소 입력'
            />
          </SimpleGrid>

          {/* Row 5: 사업자등록증, 계약서 */}
          <SimpleGrid cols={2} spacing='md'>
            <Input.Wrapper label='사업자등록증'>
              <ImageUpload
                value={form.businessRegistration}
                onChange={(url) =>
                  setForm((prev) => ({ ...prev, businessRegistration: url }))
                }
                bucket={BUCKET_NAME}
                storagePath={`${STORAGE_PATH}/business-reg`}
                accept='image/*,application/pdf'
                maxSizeMB={10}
              />
            </Input.Wrapper>
            <Input.Wrapper label='계약서'>
              <ImageUpload
                value={form.contractDocument}
                onChange={(url) =>
                  setForm((prev) => ({ ...prev, contractDocument: url }))
                }
                bucket={BUCKET_NAME}
                storagePath={`${STORAGE_PATH}/contract-doc`}
                accept='image/*,application/pdf'
                maxSizeMB={10}
              />
            </Input.Wrapper>
          </SimpleGrid>

          {/* Row 6: 계약 메모 (전체 너비) */}
          <Textarea
            id='contractMemo'
            label='계약 메모'
            value={form.contractMemo}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, contractMemo: e.target.value }))
            }
            placeholder='계약 관련 메모'
            rows={3}
          />
        </Stack>

        <Group justify='flex-end' mt='lg'>
          <Button
            variant='default'
            onClick={() => setDialogOpen(false)}
            disabled={saving}
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            leftSection={saving ? <Loader2 size={16} className='animate-spin' /> : undefined}
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </Group>
      </Modal>

      {/* 삭제 확인 다이얼로그 */}
      <Modal
        closeOnClickOutside={false}
        withCloseButton={false}
        opened={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title='광고주 삭제'
      >
        <Text size='sm' c='dimmed'>
          <Box component='span' fw={600}>{advertiserToDelete?.businessName}</Box>
          을(를) 삭제하시겠습니까?
          <br />
          이 작업은 취소할 수 없습니다.
        </Text>
        <Group justify='flex-end' mt='lg'>
          <Button variant='default' onClick={() => setDeleteDialogOpen(false)}>
            취소
          </Button>
          {/* AlertDialogAction과 동일하게 클릭 즉시 다이얼로그를 닫는다 */}
          <Button
            color='red'
            onClick={() => {
              handleDeleteConfirm();
              setDeleteDialogOpen(false);
            }}
          >
            삭제
          </Button>
        </Group>
      </Modal>
    </PageShell>
  );
}
