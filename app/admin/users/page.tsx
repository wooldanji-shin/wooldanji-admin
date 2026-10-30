'use client';

import {
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { DataPagination } from '@/components/data-pagination';
import { Button, Text } from '@mantine/core';
import { Download } from 'lucide-react';
import { ITEMS_PER_PAGE } from './constants';
import { useUsersPage } from './useUsersPage';
import { UsersFilterCard } from './components/users-filter-card';
import { UsersTable } from './components/users-table';
import { ImagePreviewOverlay } from './components/image-preview-overlay';
import { SuspendDialog } from './components/suspend-dialog';
import { UserDetailDialog } from './components/user-detail-dialog';

export default function UsersPage(): React.ReactElement {
  const page = useUsersPage();
  const { filters, options, list, imagePreview, approval, suspend, detail, exportCsv } = page;

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="회원 관리"
          description="등록된 회원 정보를 검색하고 관리합니다."
        />
        <PageHeaderActions>
          <Button
            variant='default'
            onClick={exportCsv.handleExportCSV}
            disabled={exportCsv.exporting || list.totalCount === 0}
            leftSection={<Download size={16} />}
          >
            {exportCsv.exporting ? '내보내는 중...' : 'CSV 내보내기'}
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <UsersFilterCard
              searchInput={filters.searchInput}
              apartments={options.apartments}
              buildings={options.buildings}
              selectedApartment={filters.selectedApartment}
              selectedBuilding={filters.selectedBuilding}
              selectedRegistrationType={filters.selectedRegistrationType}
              onSearch={filters.handleSearch}
              onApartmentChange={filters.handleApartmentChange}
              onBuildingChange={filters.handleBuildingChange}
              onRegistrationTypeChange={filters.handleRegistrationTypeChange}
            />
          }
          summary={
            <Text size="sm" c="dimmed">
              전체 <Text span fw={700} c="var(--mantine-color-text)">{list.totalCount}</Text>명
            </Text>
          }
        >
          <UsersTable
            users={list.users}
            partnerUserIds={list.partnerUserIds}
            loading={list.loading}
            initialLoading={list.initialLoading}
            searchQuery={filters.searchQuery}
            onDetailClick={detail.handleDetailClick}
            onPreviewImage={imagePreview.setImagePreview}
            onApprovalStatusChange={approval.handleApprovalStatusChange}
            processingUserIds={approval.processingUserIds}
            onSuspendClick={suspend.handleSuspendClick}
          />
        </DataTableShell>

        {/* Pagination */}
        {page.totalPages > 1 && (
          <DataPagination
            page={filters.currentPage}
            pageSize={ITEMS_PER_PAGE}
            totalCount={list.totalCount}
            onPageChange={filters.handlePageChange}
          />
        )}
      </PageContent>

      {/* Image Preview Modal */}
      <ImagePreviewOverlay
        imagePreview={imagePreview.imagePreview}
        onClose={imagePreview.closeImagePreview}
      />

      {/* Suspend Confirmation Dialog */}
      <SuspendDialog
        opened={suspend.opened}
        suspendingUser={suspend.suspendingUser}
        suspensionReason={suspend.suspensionReason}
        processing={suspend.processing}
        onReasonChange={suspend.setSuspensionReason}
        onClose={suspend.close}
        onConfirm={suspend.handleSuspendConfirm}
      />

      {/* 전체보기/수정 다이얼로그 */}
      <UserDetailDialog
        opened={detail.opened}
        detailUser={detail.detailUser}
        editForm={detail.editForm}
        saving={detail.saving}
        onFieldChange={detail.setField}
        onClose={detail.close}
        onSave={detail.handleDetailSave}
      />
    </PageShell>
  );
}
