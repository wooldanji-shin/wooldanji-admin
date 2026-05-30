'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';

interface AdPricingV2 {
  id: string;
  pricePerHousehold: number;
  defaultDiscountRate: number;
  premiumPricePerHouseholdPerWeek: number;
}

export default function AdPricingPage() {
  const supabase = createClient();

  const [pricing, setPricing] = useState<AdPricingV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pricePerHousehold: '',
    defaultDiscountRate: '',
    premiumPricePerHouseholdPerWeek: '',
  });

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('ad_pricing_v2')
        .select('id, pricePerHousehold, defaultDiscountRate, premiumPricePerHouseholdPerWeek')
        .single();
      if (error) throw error;
      setPricing(data);
      setForm({
        pricePerHousehold: String(data.pricePerHousehold),
        defaultDiscountRate: String(data.defaultDiscountRate),
        premiumPricePerHouseholdPerWeek: String(data.premiumPricePerHouseholdPerWeek),
      });
    } catch (err) {
      console.error('가격 정보 조회 실패:', err);
      toast.error('가격 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPricing();
  }, [fetchPricing]);

  const handleSave = async () => {
    if (!pricing) return;

    const pricePerHousehold = parseInt(form.pricePerHousehold);
    const defaultDiscountRate = parseInt(form.defaultDiscountRate);
    const premiumPricePerHouseholdPerWeek = parseInt(form.premiumPricePerHouseholdPerWeek);

    if (isNaN(pricePerHousehold) || pricePerHousehold < 0) {
      toast.error('세대당 기본 단가를 올바르게 입력해주세요.');
      return;
    }
    if (isNaN(defaultDiscountRate) || defaultDiscountRate < 0 || defaultDiscountRate > 100) {
      toast.error('기본 할인율은 0~100 사이 값을 입력해주세요.');
      return;
    }
    if (isNaN(premiumPricePerHouseholdPerWeek) || premiumPricePerHouseholdPerWeek < 0) {
      toast.error('프리미엄 주당 세대단가를 올바르게 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('ad_pricing_v2')
        .update({
          pricePerHousehold,
          defaultDiscountRate,
          premiumPricePerHouseholdPerWeek,
        })
        .eq('id', pricing.id);
      if (error) throw error;
      toast.success('가격 정보가 저장되었습니다.');
      await fetchPricing();
    } catch (err: any) {
      console.error('가격 저장 실패:', err);
      toast.error(err.message || '가격 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 px-6 py-6 md:py-8">
      <AdminHeader title="가격 변동하기" />

      {loading ? (
        <Card className="bg-card border-border max-w-lg">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border max-w-lg">
          <CardHeader>
            <CardTitle>광고 단가 설정</CardTitle>
            <CardDescription>
              변경 즉시 파트너 앱의 광고 금액 계산에 적용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="pricePerHousehold">세대당 기본 단가 (원)</Label>
              <Input
                id="pricePerHousehold"
                type="number"
                min={0}
                value={form.pricePerHousehold}
                onChange={(e) => setForm((prev) => ({ ...prev, pricePerHousehold: e.target.value }))}
                placeholder="예: 100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultDiscountRate">기본 할인율 (%)</Label>
              <Input
                id="defaultDiscountRate"
                type="number"
                min={0}
                max={100}
                value={form.defaultDiscountRate}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultDiscountRate: e.target.value }))}
                placeholder="예: 20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="premiumPricePerHouseholdPerWeek">프리미엄 주당 세대단가 (원)</Label>
              <Input
                id="premiumPricePerHouseholdPerWeek"
                type="number"
                min={0}
                value={form.premiumPricePerHouseholdPerWeek}
                onChange={(e) => setForm((prev) => ({ ...prev, premiumPricePerHouseholdPerWeek: e.target.value }))}
                placeholder="예: 20"
              />
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? '저장 중...' : '저장'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
