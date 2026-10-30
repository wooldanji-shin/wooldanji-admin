'use client';

import type { ReactElement } from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Group,
  Input,
  Modal,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { Loader2, Save, Globe, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ImageUpload } from '@/components/image-upload';
import { LinkedAdPicker } from '../LinkedAdPicker';
import { BANNERS_FOLDER, BUCKET_NAME, type Apartment, type UseBannerDialogReturn } from '../types';

interface BannerDialogProps {
  dialog: UseBannerDialogReturn;
  apartments: Apartment[];
  isSuperAdmin: boolean;
}

/** 배너 등록/수정 다이얼로그 */
export function BannerDialog({ dialog, apartments, isSuperAdmin }: BannerDialogProps): ReactElement {
  const {
    opened,
    editingBanner,
    form,
    setForm,
    apartmentSearch,
    setApartmentSearch,
    saving,
    selectableApartments,
    closeDialog,
    resetForm,
    handleSelectLinkedAd,
    handleSave,
  } = dialog;

  return (
    <Modal
      opened={opened}
      onClose={() => {
        // 저장 중에는 닫지 않는다
        if (!saving) closeDialog();
      }}
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      withCloseButton={!saving}
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
            closeDialog();
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
  );
}
