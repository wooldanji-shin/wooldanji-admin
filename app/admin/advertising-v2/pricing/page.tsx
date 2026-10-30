'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin-header';
import { PageShell } from '@/components/page-shell';
import { Button, Paper, Skeleton, Stack, Text, TextInput, Title } from '@mantine/core';
import { createClient } from '@/lib/supabase/client';

interface AdPricingV2 {
  id: string;
  pricePerHousehold: number;
  defaultDiscountRate: number;
  defaultFreeMonths: number;
  premiumPricePerHouseholdPerWeek: number;
  soloPopupPricePerHouseholdPerWeek: number;
}

export default function AdPricingPage() {
  const supabase = createClient();

  const [pricing, setPricing] = useState<AdPricingV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    pricePerHousehold: '',
    defaultDiscountRate: '',
    defaultFreeMonths: '',
    premiumPricePerHouseholdPerWeek: '',
    soloPopupPricePerHouseholdPerWeek: '',
  });

  const fetchPricing = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('ad_pricing_v2')
        .select('id, pricePerHousehold, defaultDiscountRate, defaultFreeMonths, premiumPricePerHouseholdPerWeek, soloPopupPricePerHouseholdPerWeek')
        .single();
      if (error) throw error;
      setPricing(data);
      setForm({
        pricePerHousehold: String(data.pricePerHousehold),
        defaultDiscountRate: String(data.defaultDiscountRate),
        defaultFreeMonths: String(data.defaultFreeMonths),
        premiumPricePerHouseholdPerWeek: String(data.premiumPricePerHouseholdPerWeek),
        soloPopupPricePerHouseholdPerWeek: String(data.soloPopupPricePerHouseholdPerWeek),
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
    const defaultFreeMonths = parseInt(form.defaultFreeMonths);
    const premiumPricePerHouseholdPerWeek = parseInt(form.premiumPricePerHouseholdPerWeek);
    const soloPopupPricePerHouseholdPerWeek = parseInt(form.soloPopupPricePerHouseholdPerWeek);

    if (isNaN(pricePerHousehold) || pricePerHousehold < 0) {
      toast.error('세대당 기본 단가를 올바르게 입력해주세요.');
      return;
    }
    if (isNaN(defaultDiscountRate) || defaultDiscountRate < 0 || defaultDiscountRate > 100) {
      toast.error('기본 할인율은 0~100 사이 값을 입력해주세요.');
      return;
    }
    if (isNaN(defaultFreeMonths) || defaultFreeMonths < 0) {
      toast.error('첫 광고 기본 무료 개월수를 올바르게 입력해주세요.');
      return;
    }
    if (isNaN(premiumPricePerHouseholdPerWeek) || premiumPricePerHouseholdPerWeek < 0) {
      toast.error('프리미엄 주당 세대단가를 올바르게 입력해주세요.');
      return;
    }
    if (isNaN(soloPopupPricePerHouseholdPerWeek) || soloPopupPricePerHouseholdPerWeek < 0) {
      toast.error('단독 팝업 주당 세대단가를 올바르게 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('ad_pricing_v2')
        .update({
          pricePerHousehold,
          defaultDiscountRate,
          defaultFreeMonths,
          premiumPricePerHouseholdPerWeek,
          soloPopupPricePerHouseholdPerWeek,
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
    <PageShell>
      <AdminHeader title="가격 변동하기" />

      {loading ? (
        <Paper withBorder radius="md" p="lg" maw={512}>
          <Stack gap="md">
            <Skeleton h={20} w={160} />
            <Skeleton h={16} w={256} />
            <Skeleton h={36} />
            <Skeleton h={36} />
            <Skeleton h={36} />
          </Stack>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="lg" maw={512}>
          <Stack gap={4} mb="lg">
            <Title order={4}>광고 단가 설정</Title>
            <Text size="sm" c="dimmed">
              변경 즉시 파트너 앱의 광고 금액 계산에 적용됩니다.
            </Text>
          </Stack>
          <Stack gap="lg">
            <TextInput
              id="pricePerHousehold"
              label="세대당 기본 단가 (원)"
              type="number"
              min={0}
              value={form.pricePerHousehold}
              onChange={(e) => setForm((prev) => ({ ...prev, pricePerHousehold: e.target.value }))}
              placeholder="예: 100"
            />

            <TextInput
              id="defaultDiscountRate"
              label="기본 할인율 (%)"
              type="number"
              min={0}
              max={100}
              value={form.defaultDiscountRate}
              onChange={(e) => setForm((prev) => ({ ...prev, defaultDiscountRate: e.target.value }))}
              placeholder="예: 20"
            />

            <TextInput
              id="defaultFreeMonths"
              label="첫 광고 기본 무료 개월수"
              type="number"
              min={0}
              value={form.defaultFreeMonths}
              onChange={(e) => setForm((prev) => ({ ...prev, defaultFreeMonths: e.target.value }))}
              placeholder="예: 1"
              description="광고 승인 화면의 무료 개월수 기본값입니다. 승인 시 건별로 변경할 수 있습니다."
              inputWrapperOrder={['label', 'input', 'description', 'error']}
            />

            <TextInput
              id="premiumPricePerHouseholdPerWeek"
              label="프리미엄 주당 세대단가 (원)"
              type="number"
              min={0}
              value={form.premiumPricePerHouseholdPerWeek}
              onChange={(e) => setForm((prev) => ({ ...prev, premiumPricePerHouseholdPerWeek: e.target.value }))}
              placeholder="예: 20"
            />

            <TextInput
              id="soloPopupPricePerHouseholdPerWeek"
              label="단독 팝업 주당 세대단가 (원)"
              type="number"
              min={0}
              value={form.soloPopupPricePerHouseholdPerWeek}
              onChange={(e) => setForm((prev) => ({ ...prev, soloPopupPricePerHouseholdPerWeek: e.target.value }))}
              placeholder="예: 50"
              description="1개월은 4주로 환산해 계산합니다. 서버(DB 함수)가 이 값으로 금액을 계산합니다."
              inputWrapperOrder={['label', 'input', 'description', 'error']}
            />

            <Button onClick={handleSave} disabled={saving} fullWidth>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </Stack>
        </Paper>
      )}
    </PageShell>
  );
}
