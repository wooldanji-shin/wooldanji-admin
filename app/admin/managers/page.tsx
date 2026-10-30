'use client';

import type { ReactElement } from 'react';
import {
  PageContent,
  PageHeader,
  PageHeaderTitle,
  PageShell,
} from '@/components/page-shell';
import { DataTableShell } from '@/components/data-table-shell';
import { Text } from '@mantine/core';
import { useManagersPage } from './useManagersPage';
import { ManagersToolbar } from './components/managers-toolbar';
import { ManagersTable } from './components/managers-table';
import { ImagePreview } from './components/image-preview';
import { SuspendDialog } from './components/suspend-dialog';
import { DeleteDialog } from './components/delete-dialog';
import { ScopeDialog } from './components/scope-dialog';
import { DetailDialog } from './components/detail-dialog';

export default function ManagersPage(): ReactElement {
  const page = useManagersPage();

  return (
    <PageShell>
      <PageHeader>
        <PageHeaderTitle
          title="관리자 관리"
          description="관리자 권한 범위와 승인 상태를 관리합니다."
        />
      </PageHeader>

      <PageContent>
        <DataTableShell
          toolbar={
            <ManagersToolbar
              searchQuery={page.searchInput}
              onSearchChange={page.setSearchInput}
              apartments={page.fetch.apartments}
              filterApartment={page.filterApartment}
              onFilterApartmentChange={page.setFilterApartment}
            />
          }
          summary={
            <Text size="sm" c="dimmed">
              전체 <Text span fw={700} c="var(--mantine-color-text)">{page.filteredManagers.length}</Text>명
            </Text>
          }
        >
          <ManagersTable
            loading={page.fetch.loading}
            managers={page.filteredManagers}
            searchQuery={page.searchInput}
            onDetailClick={page.detail.open}
            onImagePreview={page.setImagePreview}
            onEditScope={page.scope.open}
            onApprovalStatusChange={page.actions.handleApprovalStatusChange}
            processingUserIds={page.actions.processingUserIds}
            onSuspendClick={page.suspend.open}
            onDeleteClick={page.remove.open}
          />
        </DataTableShell>
      </PageContent>

      {/* Image Preview Modal */}
      <ImagePreview imagePreview={page.imagePreview} onClose={page.setImagePreview} />

      {/* Suspend Confirmation Dialog */}
      <SuspendDialog dialog={page.suspend} />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog dialog={page.remove} />

      {/* Edit Modal */}
      <ScopeDialog dialog={page.scope} apartments={page.fetch.apartments} />

      {/* Detail Dialog */}
      <DetailDialog dialog={page.detail} />
    </PageShell>
  );
}
