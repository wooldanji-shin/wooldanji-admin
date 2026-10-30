'use client';

import type { ReactElement } from 'react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { Alert } from '@mantine/core';
import { AlertCircle } from 'lucide-react';
import { useBannersPage } from './useBannersPage';
import { BannerList } from './components/BannerList';
import { BannerDialog } from './components/BannerDialog';
import { ResetClickDialog } from './components/ResetClickDialog';

export default function BannersPage(): ReactElement {
  const page = useBannersPage();

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
        <BannerList
          banners={page.fetch.banners}
          loading={page.fetch.loading}
          hideClickCounts={page.clickCounts.hideClickCounts}
          onHideClickCountsChange={page.clickCounts.handleHideClickCountsChange}
          onAddNew={page.dialog.handleAddNew}
          togglingId={page.actions.togglingId}
          deletingId={page.actions.deletingId}
          onEdit={page.dialog.handleEdit}
          onDelete={page.actions.handleDelete}
          onToggleActive={page.actions.handleToggleActive}
          onResetClick={page.actions.openResetClick}
          canEditBanner={page.fetch.canEditBanner}
          canDeleteBanner={page.fetch.canDeleteBanner}
        />

        {/* Add/Edit Dialog */}
        <BannerDialog
          dialog={page.dialog}
          apartments={page.fetch.apartments}
          isSuperAdmin={page.fetch.isSuperAdmin}
        />

        {/* 클릭수 초기화 확인 다이얼로그 */}
        <ResetClickDialog
          opened={page.actions.resetClick.opened}
          resetClickBanner={page.actions.resetClick.banner}
          processing={page.actions.resetting}
          onClose={page.actions.closeResetClick}
          onCancel={page.actions.cancelResetClick}
          onConfirm={page.actions.handleResetClickCount}
        />
      </PageContent>
    </PageShell>
  );
}
