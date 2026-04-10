'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export type AdStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'ended' | 'draft';
export type ModificationStatus = 'pending' | 'approved' | 'rejected' | null;
export type PaymentStatus = 'unpaid' | 'paid';
export type StatusFilter = 'pending' | 'approved' | 'all' | 'modification';

export interface AdCategory {
  id: string;
  categoryName: string;
}

export interface ApartmentSummary {
  apartmentId: string;
  apartmentName: string;
  totalHouseholds: number;
}

export interface AdApplication {
  id: string;
  title: string;
  content: string | null;
  adStatus: AdStatus;
  paymentStatus: PaymentStatus;
  modificationStatus: ModificationStatus;
  submittedAt: string | null;
  freeMonths: number;
  adminExtraMonths: number;
  partner_users: {
    businessName: string;
    displayPhoneNumber: string | null;
  } | null;
  ad_categories_v2: {
    categoryName: string;
  } | null;
  subCategoryNames: string[];
  apartments: ApartmentSummary[];
}

export interface UseApplicationsPageReturn {
  applications: AdApplication[];
  loading: boolean;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  categoryFilter: string | null;
  setCategoryFilter: (id: string | null) => void;
  categories: AdCategory[];
  pricePerHousehold: number;
  handleRowClick: (id: string) => void;
}

export function useApplicationsPage(): UseApplicationsPageReturn {
  const router = useRouter();
  const supabase = createClient();

  const [applications, setApplications] = useState<AdApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [categories, setCategories] = useState<AdCategory[]>([]);
  const [pricePerHousehold, setPricePerHousehold] = useState(70);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('ad_categories_v2')
      .select('id, categoryName')
      .order('categoryName');
    setCategories((data as AdCategory[]) ?? []);
  }, [supabase]);

  const fetchPricing = useCallback(async () => {
    const { data } = await supabase
      .from('ad_pricing_v2')
      .select('pricePerHousehold')
      .order('effectiveFrom', { ascending: false })
      .limit(1)
      .single();
    if (data) setPricePerHousehold((data as any).pricePerHousehold ?? 70);
  }, [supabase]);

  useEffect(() => {
    fetchCategories();
    fetchPricing();
  }, [fetchCategories, fetchPricing]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('advertisements_v2')
        .select(`
          id,
          title,
          content,
          adStatus,
          paymentStatus,
          modificationStatus,
          submittedAt,
          freeMonths,
          adminExtraMonths,
          partner_users:partnerId(businessName, displayPhoneNumber),
          ad_categories_v2:categoryId(categoryName),
          advertisement_sub_categories_v2(subCategoryId, ad_sub_categories_v2(subCategoryName)),
          advertisement_apartments_v2(
            apartmentId,
            totalHouseholds,
            apartments:apartmentId(name)
          )
        `)
        .order('submittedAt', { ascending: false });

      if (statusFilter === 'pending') {
        query = query.eq('adStatus', 'pending');
      } else if (statusFilter === 'approved') {
        query = query.eq('adStatus', 'approved');
      } else if (statusFilter === 'modification') {
        query = query.eq('modificationStatus', 'pending');
      }

      if (categoryFilter) {
        query = query.eq('categoryId', categoryFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: AdApplication[] = (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        adStatus: row.adStatus,
        paymentStatus: row.paymentStatus,
        modificationStatus: row.modificationStatus ?? null,
        submittedAt: row.submittedAt,
        freeMonths: row.freeMonths,
        adminExtraMonths: row.adminExtraMonths,
        partner_users: row.partner_users,
        ad_categories_v2: row.ad_categories_v2,
        subCategoryNames: (row.advertisement_sub_categories_v2 ?? []).map(
          (sc: any) => sc.ad_sub_categories_v2?.subCategoryName ?? ''
        ).filter(Boolean),
        apartments: (row.advertisement_apartments_v2 ?? []).map((apt: any) => ({
          apartmentId: apt.apartmentId,
          apartmentName: apt.apartments?.name ?? '-',
          totalHouseholds: apt.totalHouseholds,
        })),
      }));

      setApplications(mapped);
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleRowClick = (id: string): void => {
    router.push(`/admin/advertising-v2/applications/${id}`);
  };

  return {
    applications,
    loading,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    categories,
    pricePerHousehold,
    handleRowClick,
  };
}
