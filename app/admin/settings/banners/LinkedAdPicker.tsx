'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

/** 배너에 연결할 수 있는 광고 — 기본 광고 또는 프리미엄 광고 */
export interface LinkableAd {
  kind: 'base' | 'premium';
  id: string;
  title: string;
  businessName: string;
  /** 이 광고가 지금 노출되는 아파트 — 배너 대상 아파트는 이 안에서만 고를 수 있다 */
  apartmentIds: string[];
  apartmentNames: string[];
}

export interface LinkedAdValue {
  linkedAdId: string | null;
  linkedPremiumAdId: string | null;
}

interface ApartmentRow {
  apartmentId: string;
  apartments: { name: string } | null;
}

/** 노출 중인 광고만 연결 대상 — 앱의 get_home_banners linkedAdAvailable 조건과 같다 */
async function fetchLinkableAds(): Promise<LinkableAd[]> {
  const supabase = createClient();

  const [baseRes, premiumRes] = await Promise.all([
    supabase
      .from('advertisements_v2')
      .select('id, title, isHidden, partner_users:partnerId(businessName), advertisement_apartments_v2(apartmentId, apartments:apartmentId(name))')
      .eq('adStatus', 'running'),
    supabase
      .from('premium_advertisements_v2')
      .select('id, title, endedAt, advertisements_v2:baseAdId(title, isHidden, partner_users:partnerId(businessName), advertisement_apartments_v2(apartmentId, apartments:apartmentId(name)))')
      .eq('status', 'running')
      .gt('endedAt', new Date().toISOString()),
  ]);

  const toApartments = (rows: ApartmentRow[] | null | undefined) => ({
    apartmentIds: (rows ?? []).map((r) => r.apartmentId),
    apartmentNames: (rows ?? []).map((r) => r.apartments?.name ?? '-'),
  });

  const baseAds: LinkableAd[] = ((baseRes.data ?? []) as any[])
    .filter((ad) => ad.isHidden !== true)
    .map((ad) => ({
      kind: 'base',
      id: ad.id,
      title: ad.title ?? '제목 없음',
      businessName: ad.partner_users?.businessName ?? '',
      ...toApartments(ad.advertisement_apartments_v2),
    }));

  // 프리미엄은 노출 아파트를 기본 광고에서 가져온다
  const premiumAds: LinkableAd[] = ((premiumRes.data ?? []) as any[])
    .filter((p) => p.advertisements_v2 && p.advertisements_v2.isHidden !== true)
    .map((p) => ({
      kind: 'premium',
      id: p.id,
      title: p.title ?? p.advertisements_v2.title ?? '제목 없음',
      businessName: p.advertisements_v2.partner_users?.businessName ?? '',
      ...toApartments(p.advertisements_v2.advertisement_apartments_v2),
    }));

  return [...premiumAds, ...baseAds];
}

export function isSameLinkedAd(ad: LinkableAd, value: LinkedAdValue): boolean {
  return ad.kind === 'premium' ? ad.id === value.linkedPremiumAdId : ad.id === value.linkedAdId;
}

/**
 * 배너에 연결할 광고 선택.
 * 고른 광고의 노출 아파트를 함께 보여주고, 부모가 배너 대상 아파트를 그 안으로 제한할 수 있게 넘긴다.
 */
export function LinkedAdPicker({
  value,
  onChange,
}: {
  value: LinkedAdValue;
  onChange: (ad: LinkableAd | null) => void;
}) {
  const [ads, setAds] = useState<LinkableAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLinkableAds()
      .then((list) => {
        setAds(list);
        // 수정 모드 — 저장된 연결 광고의 노출 아파트를 부모에 알린다 (종료됐으면 null)
        if (value.linkedAdId || value.linkedPremiumAdId) {
          onChange(list.find((ad) => isSameLinkedAd(ad, value)) ?? null);
        }
      })
      .finally(() => setLoading(false));
    // 처음 열 때 한 번만 불러온다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return ads;
    return ads.filter((ad) =>
      ad.title.toLowerCase().includes(keyword) || ad.businessName.toLowerCase().includes(keyword)
    );
  }, [ads, search]);

  const selected = ads.find((ad) => isSameLinkedAd(ad, value)) ?? null;
  const hasStaleLink = !loading && !selected && !!(value.linkedAdId || value.linkedPremiumAdId);

  return (
    <div className='space-y-2'>
      <div className='border rounded-md'>
        <div className='p-2 border-b'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
            <Input
              placeholder='상호명 또는 광고 제목 검색...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='pl-9'
            />
          </div>
        </div>
        <div className='h-[200px] overflow-y-auto p-2 space-y-1'>
          {loading ? (
            <p className='text-sm text-muted-foreground text-center py-4'>불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <p className='text-sm text-muted-foreground text-center py-4'>노출 중인 광고가 없습니다.</p>
          ) : (
            filtered.map((ad) => (
              <button
                key={`${ad.kind}-${ad.id}`}
                type='button'
                onClick={() => onChange(ad)}
                className={`w-full rounded p-2 text-left text-sm hover:bg-muted/50 ${
                  isSameLinkedAd(ad, value) ? 'bg-primary/10 ring-1 ring-primary' : ''
                }`}
              >
                <span className='mr-1 text-xs font-medium text-primary'>
                  {ad.kind === 'premium' ? '[프리미엄]' : '[기본]'}
                </span>
                {ad.businessName} · {ad.title}
                <span className='ml-1 text-xs text-muted-foreground'>({ad.apartmentIds.length}개 아파트)</span>
              </button>
            ))
          )}
        </div>
      </div>

      {hasStaleLink && (
        <p className='text-xs text-destructive'>
          연결된 광고가 종료되었거나 노출 중이 아닙니다. 앱에서 배너를 눌러도 반응하지 않으니 다른 광고를 연결하거나 배너를 내려주세요.
        </p>
      )}

      {selected && (
        <div className='rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1'>
          <p className='font-medium'>
            광고 노출 아파트 ({selected.apartmentIds.length}곳) — 배너 대상 아파트는 이 안에서만 고를 수 있습니다
          </p>
          <p className='text-muted-foreground'>{selected.apartmentNames.join(', ') || '-'}</p>
        </div>
      )}
    </div>
  );
}
