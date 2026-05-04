'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface PartnerDetail {
  id: string;
  userId: string;
  businessName: string;
  representativeName: string;
  displayPhoneNumber: string | null;
  phoneNumber: string | null;
  businessAddress: string | null;
  businessDetailAddress: string | null;
  businessRegistrationNumber: string | null;
  businessRegistrationImageUrl: string | null;
  businessHoursNote: string | null;
  parkingInfo: string | null;
  hasHadRunningAd: boolean;
  marketingAgreed: boolean;
  createdAt: string;
  categoryName: string | null;
}

export interface AdHistoryItem {
  id: string;
  title: string | null;
  adStatus: string;
  paymentStatus: string;
  isFirstAdApplication: boolean | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface UsePartnerDetailPageReturn {
  partner: PartnerDetail | null;
  adHistory: AdHistoryItem[];
  loading: boolean;
  handleAdClick: (adId: string) => void;
  handleBack: () => void;
}

export function usePartnerDetailPage(
  params: Promise<{ id: string }>
): UsePartnerDetailPageReturn {
  const router = useRouter();
  const supabase = createClient();

  const [partnerId, setPartnerId] = useState<string>('');
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [adHistory, setAdHistory] = useState<AdHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setPartnerId(p.id));
  }, [params]);

  const fetchDetail = useCallback(async (): Promise<void> => {
    if (!partnerId) return;
    setLoading(true);
    try {
      const { data: partnerData, error: partnerError } = await supabase
        .from('partner_users')
        .select(
          'id, userId, businessName, representativeName, displayPhoneNumber, phoneNumber, businessAddress, businessDetailAddress, businessRegistrationNumber, businessRegistrationImageUrl, businessHoursNote, parkingInfo, hasHadRunningAd, marketingAgreed, createdAt, ad_categories_v2:categoryId(categoryName)'
        )
        .eq('id', partnerId)
        .single();

      if (partnerError) throw partnerError;

      const row = partnerData as any;
      const mapped: PartnerDetail = {
        id: row.id,
        userId: row.userId,
        businessName: row.businessName,
        representativeName: row.representativeName,
        displayPhoneNumber: row.displayPhoneNumber,
        phoneNumber: row.phoneNumber,
        businessAddress: row.businessAddress,
        businessDetailAddress: row.businessDetailAddress,
        businessRegistrationNumber: row.businessRegistrationNumber,
        businessRegistrationImageUrl: row.businessRegistrationImageUrl,
        businessHoursNote: row.businessHoursNote,
        parkingInfo: row.parkingInfo,
        hasHadRunningAd: row.hasHadRunningAd,
        marketingAgreed: row.marketingAgreed,
        createdAt: row.createdAt,
        categoryName: (row.ad_categories_v2 as any)?.categoryName ?? null,
      };
      setPartner(mapped);

      const { data: adsData, error: adsError } = await supabase
        .from('advertisements_v2')
        .select('id, title, adStatus, paymentStatus, isFirstAdApplication, submittedAt, createdAt')
        .eq('partnerId', row.userId)
        .neq('adStatus', 'draft')
        .order('createdAt', { ascending: false });

      if (adsError) throw adsError;

      setAdHistory(
        (adsData ?? []).map((ad: any) => ({
          id: ad.id,
          title: ad.title,
          adStatus: ad.adStatus,
          paymentStatus: ad.paymentStatus,
          isFirstAdApplication: ad.isFirstAdApplication,
          submittedAt: ad.submittedAt,
          createdAt: ad.createdAt,
        }))
      );
    } catch (err) {
      console.error('파트너 상세 로드 실패:', err);
      toast.error('파트너 정보를 불러오는데 실패했습니다.');
      router.push('/admin/partners');
    } finally {
      setLoading(false);
    }
  }, [partnerId, supabase, router]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleAdClick = (adId: string): void => {
    router.push(`/admin/advertising-v2/applications/${adId}`);
  };

  const handleBack = (): void => {
    router.push('/admin/partners');
  };

  return { partner, adHistory, loading, handleAdClick, handleBack };
}
