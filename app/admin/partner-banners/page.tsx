'use client';

// Design Ref: §6.3 partner-banners 페이지 — 탭 2(케이스 4행 + 파트너 검색·편집)
// Plan SC: SC-4(케이스 공통 배너) / SC-5(파트너 개별 배너) / SC-6(비활성/만료)
// Decision: Design §4.4의 별도 API route 대신 admin CRUD 일관성을 위해
//           page.tsx에서 supabase 직접 호출 (RLS가 admin 권한 검증).

import { AdminHeader } from '@/components/admin-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/supabase';
import {
  Loader2,
  AlertCircle,
  Megaphone,
  Search,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type BannerType = 'case' | 'partner';
type BannerCase = 'A' | 'B' | 'C';

interface PartnerBanner {
  id: string;
  bannerType: BannerType;
  targetCase: BannerCase | null;
  targetPartnerUserId: string | null;
  title: string;
  content: string;
  isActive: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PartnerSearchRow {
  id: string;
  businessName: string | null;
  representativeName: string | null;
  displayPhoneNumber: string | null;
}

const CASE_LABELS: Record<BannerCase, string> = {
  A: '광고전 (running 0개)',
  B: '광고중 (running 1개+)',
  C: '광고중단 (ended만 보유)',
};

const CASES: BannerCase[] = ['A', 'B', 'C'];

export default function PartnerBannersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseBanners, setCaseBanners] = useState<PartnerBanner[]>([]);
  const [partnerBanners, setPartnerBanners] = useState<PartnerBanner[]>([]);

  // 모달 상태
  const [editing, setEditing] = useState<{
    bannerType: BannerType;
    targetCase?: BannerCase;
    targetPartnerUserId?: string;
    targetPartnerLabel?: string;
    existing?: PartnerBanner;
  } | null>(null);

  // 파트너 검색
  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerSearchResults, setPartnerSearchResults] = useState<PartnerSearchRow[]>([]);
  const [partnerSearchLoading, setPartnerSearchLoading] = useState(false);

  useEffect(() => {
    void initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialLoad() {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.push('/login');
        return;
      }
      await Promise.all([loadCaseBanners(), loadPartnerBanners()]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? '초기 로드 실패');
    } finally {
      setLoading(false);
    }
  }

  async function loadCaseBanners() {
    const { data, error: fetchErr } = await supabase
      .from('partner_banners')
      .select('*')
      .eq('bannerType', 'case')
      .order('targetCase', { ascending: true });
    if (fetchErr) throw fetchErr;
    setCaseBanners((data ?? []) as PartnerBanner[]);
  }

  async function loadPartnerBanners() {
    const { data, error: fetchErr } = await supabase
      .from('partner_banners')
      .select('*')
      .eq('bannerType', 'partner')
      .order('updatedAt', { ascending: false });
    if (fetchErr) throw fetchErr;
    setPartnerBanners((data ?? []) as PartnerBanner[]);
  }

  // ─── 케이스 공통 배너 ───────────────────────────────────────────
  const caseRows = useMemo(() => {
    return CASES.map((c) => ({
      caseKey: c,
      banner: caseBanners.find((b) => b.targetCase === c) ?? null,
    }));
  }, [caseBanners]);

  function openCaseEditor(c: BannerCase, existing: PartnerBanner | null) {
    setEditing({
      bannerType: 'case',
      targetCase: c,
      existing: existing ?? undefined,
    });
  }

  // ─── 파트너 개별 배너 ───────────────────────────────────────────
  async function searchPartners() {
    const q = partnerSearch.trim();
    if (!q) {
      setPartnerSearchResults([]);
      return;
    }
    try {
      setPartnerSearchLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('partner_users')
        .select('id, businessName, representativeName, displayPhoneNumber')
        .or(
          `businessName.ilike.%${q}%,representativeName.ilike.%${q}%,displayPhoneNumber.ilike.%${q}%`,
        )
        .limit(20);
      if (fetchErr) throw fetchErr;
      setPartnerSearchResults((data ?? []) as PartnerSearchRow[]);
    } catch (e: any) {
      toast.error(`파트너 검색 실패: ${e?.message ?? e}`);
    } finally {
      setPartnerSearchLoading(false);
    }
  }

  function openPartnerEditor(p: PartnerSearchRow) {
    const existing = partnerBanners.find((b) => b.targetPartnerUserId === p.id);
    setEditing({
      bannerType: 'partner',
      targetPartnerUserId: p.id,
      targetPartnerLabel:
        p.businessName ?? p.representativeName ?? p.displayPhoneNumber ?? p.id,
      existing,
    });
  }

  function openExistingPartnerEditor(b: PartnerBanner) {
    setEditing({
      bannerType: 'partner',
      targetPartnerUserId: b.targetPartnerUserId ?? '',
      targetPartnerLabel: '(목록에서 진입)',
      existing: b,
    });
  }

  // ─── 토글 / 삭제 ────────────────────────────────────────────────
  async function toggleActive(b: PartnerBanner) {
    try {
      const { error: updateErr } = await supabase
        .from('partner_banners')
        .update({ isActive: !b.isActive })
        .eq('id', b.id);
      if (updateErr) throw updateErr;
      toast.success(b.isActive ? '비활성화 완료' : '활성화 완료');
      await Promise.all([loadCaseBanners(), loadPartnerBanners()]);
    } catch (e: any) {
      toast.error(`토글 실패: ${e?.message ?? e}`);
    }
  }

  async function deleteBanner(b: PartnerBanner) {
    if (!confirm('이 배너를 삭제하시겠습니까?')) return;
    try {
      const { error: deleteErr } = await supabase
        .from('partner_banners')
        .delete()
        .eq('id', b.id);
      if (deleteErr) throw deleteErr;
      toast.success('삭제 완료');
      await Promise.all([loadCaseBanners(), loadPartnerBanners()]);
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.message ?? e}`);
    }
  }

  if (loading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant='destructive'>
        <AlertCircle className='h-4 w-4' />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className='space-y-6'>
      <AdminHeader
        title='파트너 안내 배너'
        description='나의광고 화면 상단 + 회원가입 시작 화면 상단 배너 (케이스 공통 또는 특정 파트너)'
      />

      <Tabs defaultValue='case'>
        <TabsList>
          <TabsTrigger value='case'>케이스 공통 배너</TabsTrigger>
          <TabsTrigger value='partner'>파트너 개별 배너</TabsTrigger>
        </TabsList>

        {/* 케이스 탭 */}
        <TabsContent value='case'>
          <Card>
            <CardHeader>
              <CardTitle>케이스 공통 배너 (A/B/C)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[15%]'>케이스</TableHead>
                    <TableHead className='w-[25%]'>제목</TableHead>
                    <TableHead className='w-[15%]'>활성</TableHead>
                    <TableHead className='w-[15%]'>시작</TableHead>
                    <TableHead className='w-[15%]'>종료</TableHead>
                    <TableHead className='w-[15%] text-right'>관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caseRows.map(({ caseKey, banner }) => (
                    <TableRow key={caseKey}>
                      <TableCell>
                        <div className='font-medium'>{caseKey}</div>
                        <div className='text-xs text-muted-foreground'>
                          {CASE_LABELS[caseKey]}
                        </div>
                      </TableCell>
                      <TableCell>
                        {banner ? (
                          <span className='line-clamp-2'>{banner.title}</span>
                        ) : (
                          <span className='text-muted-foreground'>(없음)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {banner ? (
                          <div className='flex items-center gap-2'>
                            <Switch
                              checked={banner.isActive}
                              onCheckedChange={() => toggleActive(banner)}
                            />
                            <Badge
                              variant={banner.isActive ? 'default' : 'secondary'}
                            >
                              {banner.isActive ? '활성' : '비활성'}
                            </Badge>
                          </div>
                        ) : (
                          <span className='text-muted-foreground'>-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {banner?.startAt
                          ? format(new Date(banner.startAt), 'yyyy-MM-dd', {
                              locale: ko,
                            })
                          : banner
                            ? '즉시'
                            : '-'}
                      </TableCell>
                      <TableCell>
                        {banner?.endAt
                          ? format(new Date(banner.endAt), 'yyyy-MM-dd', {
                              locale: ko,
                            })
                          : banner
                            ? '무기한'
                            : '-'}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => openCaseEditor(caseKey, banner)}
                        >
                          <Pencil className='mr-1 h-3 w-3' />
                          {banner ? '편집' : '신규'}
                        </Button>
                        {banner ? (
                          <Button
                            size='sm'
                            variant='ghost'
                            className='ml-1 text-destructive'
                            onClick={() => deleteBanner(banner)}
                          >
                            <Trash2 className='h-3 w-3' />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 파트너 탭 */}
        <TabsContent value='partner' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>파트너 검색</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='flex gap-2'>
                <Input
                  placeholder='상호명 / 대표자명 / 전화번호'
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') searchPartners();
                  }}
                />
                <Button onClick={searchPartners} disabled={partnerSearchLoading}>
                  {partnerSearchLoading ? (
                    <Loader2 className='mr-1 h-4 w-4 animate-spin' />
                  ) : (
                    <Search className='mr-1 h-4 w-4' />
                  )}
                  검색
                </Button>
              </div>

              {partnerSearchResults.length > 0 && (
                <Table className='mt-4'>
                  <TableHeader>
                    <TableRow>
                      <TableHead>상호명</TableHead>
                      <TableHead>대표자</TableHead>
                      <TableHead>전화</TableHead>
                      <TableHead>현재 배너</TableHead>
                      <TableHead className='text-right'>관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerSearchResults.map((p) => {
                      const exists = partnerBanners.find(
                        (b) => b.targetPartnerUserId === p.id,
                      );
                      return (
                        <TableRow key={p.id}>
                          <TableCell>{p.businessName ?? '-'}</TableCell>
                          <TableCell>{p.representativeName ?? '-'}</TableCell>
                          <TableCell>{p.displayPhoneNumber ?? '-'}</TableCell>
                          <TableCell>
                            {exists ? (
                              <Badge variant={exists.isActive ? 'default' : 'secondary'}>
                                {exists.isActive ? '활성' : '비활성'}
                              </Badge>
                            ) : (
                              <span className='text-muted-foreground'>없음</span>
                            )}
                          </TableCell>
                          <TableCell className='text-right'>
                            <Button
                              size='sm'
                              variant='outline'
                              onClick={() => openPartnerEditor(p)}
                            >
                              <Pencil className='mr-1 h-3 w-3' />
                              {exists ? '편집' : '신규'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 등록된 파트너 배너 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>등록된 파트너 개별 배너 ({partnerBanners.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {partnerBanners.length === 0 ? (
                <div className='py-8 text-center text-muted-foreground'>
                  등록된 파트너 배너가 없습니다
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제목</TableHead>
                      <TableHead className='w-[15%]'>활성</TableHead>
                      <TableHead className='w-[20%]'>업데이트</TableHead>
                      <TableHead className='w-[20%] text-right'>관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partnerBanners.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className='font-medium'>{b.title}</div>
                          <div className='line-clamp-1 text-xs text-muted-foreground'>
                            {b.content}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <Switch
                              checked={b.isActive}
                              onCheckedChange={() => toggleActive(b)}
                            />
                            <Badge variant={b.isActive ? 'default' : 'secondary'}>
                              {b.isActive ? '활성' : '비활성'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(b.updatedAt), 'yyyy-MM-dd HH:mm', {
                            locale: ko,
                          })}
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => openExistingPartnerEditor(b)}
                          >
                            <Pencil className='mr-1 h-3 w-3' />
                            편집
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            className='ml-1 text-destructive'
                            onClick={() => deleteBanner(b)}
                          >
                            <Trash2 className='h-3 w-3' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 편집 모달 */}
      <BannerEditorDialog
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await Promise.all([loadCaseBanners(), loadPartnerBanners()]);
        }}
      />
    </div>
  );
}

// =====================================================================
// 배너 편집 모달 — 케이스 / 파트너 공용. UPSERT는 onConflict로 1행 보장.
// =====================================================================
function BannerEditorDialog({
  editing,
  onClose,
  onSaved,
}: {
  editing: {
    bannerType: BannerType;
    targetCase?: BannerCase;
    targetPartnerUserId?: string;
    targetPartnerLabel?: string;
    existing?: PartnerBanner;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    if (editing.existing) {
      setTitle(editing.existing.title);
      setContent(editing.existing.content);
      setIsActive(editing.existing.isActive);
      setStartAt(toLocalDateString(editing.existing.startAt));
      setEndAt(toLocalDateString(editing.existing.endAt));
    } else {
      setTitle('');
      setContent('');
      setIsActive(true);
      setStartAt('');
      setEndAt('');
    }
  }, [editing]);

  if (!editing) return null;

  const headerLabel =
    editing.bannerType === 'case'
      ? `케이스 ${editing.targetCase} — ${editing.existing ? '편집' : '신규'}`
      : `파트너 (${editing.targetPartnerLabel}) — ${editing.existing ? '편집' : '신규'}`;

  async function handleSave() {
    if (!editing) return;
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bannerType: editing.bannerType,
        targetCase: editing.bannerType === 'case' ? editing.targetCase : null,
        targetPartnerUserId:
          editing.bannerType === 'partner' ? editing.targetPartnerUserId : null,
        title: title.trim(),
        content: content.trim(),
        isActive,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
      };

      // partial unique index는 ON CONFLICT (col) 단순 호출과 매칭되지 않으므로
      // 기존 row 유무에 따라 update/insert 분기 (case당 1행 / partner당 1행은 UI에서 보장)
      const saveErr = editing.existing
        ? (
            await supabase
              .from('partner_banners')
              .update(payload)
              .eq('id', editing.existing.id)
          ).error
        : (await supabase.from('partner_banners').insert(payload)).error;

      if (saveErr) throw saveErr;
      toast.success('저장되었습니다');
      onSaved();
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.message ?? e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!editing} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Megaphone className='h-4 w-4 text-primary' />
            {headerLabel}
          </DialogTitle>
          <DialogDescription>
            케이스/파트너당 1행만 존재합니다. 저장 시 기존 배너가 있으면 덮어씁니다.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div>
            <Label htmlFor='banner-title'>제목</Label>
            <Input
              id='banner-title'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              placeholder='예: 가입 환영 — 첫 광고 무료'
            />
          </div>
          <div>
            <Label htmlFor='banner-content'>내용</Label>
            <Textarea
              id='banner-content'
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={300}
              placeholder='예: 신규 파트너 회원에게는 첫 달 광고 비용을 면제합니다.'
            />
          </div>
          <div className='flex items-center gap-3'>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>활성</Label>
            <Badge variant={isActive ? 'default' : 'secondary'}>
              {isActive ? '활성' : '비활성'}
            </Badge>
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <Label htmlFor='banner-start'>시작 일시 (선택)</Label>
              <Input
                id='banner-start'
                type='datetime-local'
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <div className='mt-1 text-xs text-muted-foreground'>
                비워두면 즉시 시작
              </div>
            </div>
            <div>
              <Label htmlFor='banner-end'>종료 일시 (선택)</Label>
              <Input
                id='banner-end'
                type='datetime-local'
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
              <div className='mt-1 text-xs text-muted-foreground'>
                비워두면 무기한
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className='mr-1 h-4 w-4 animate-spin' />
            ) : null}
            저장 (UPSERT)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalDateString(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // datetime-local 입력은 'YYYY-MM-DDTHH:mm' 포맷 (로컬 시간)
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
