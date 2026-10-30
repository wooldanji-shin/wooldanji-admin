import { Group, Paper, SimpleGrid, Skeleton, Stack, Table } from '@mantine/core';
import {
  PageContent,
  PageHeader,
  PageShell,
} from '@/components/page-shell';

interface PageSkeletonProps {
  /** Number of stat cards to render at the top. Set to 0 to hide. */
  stats?: number;
  /** Whether to render a search/filter bar placeholder above the main card. */
  searchBar?: boolean;
  /** Number of rows in the main table card. Set to 0 to hide the card. */
  rows?: number;
  /** Number of columns in the main table card. */
  columns?: number;
  className?: string;
}

/**
 * Full-page skeleton used while a list/table page loads.
 * Mirrors the standard PageShell -> PageHeader -> [stats] -> [search] -> [table] layout.
 */
export function PageSkeleton({
  stats = 0,
  searchBar = true,
  rows = 8,
  columns = 5,
  className,
}: PageSkeletonProps): React.ReactElement {
  return (
    <PageShell className={className}>
      <PageHeader>
        <Stack gap="xs">
          <Skeleton h={28} w={192} />
          <Skeleton h={16} w={288} />
        </Stack>
        <Skeleton h={36} w={96} />
      </PageHeader>

      <PageContent>
        {stats > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
            {Array.from({ length: stats }).map((_, i) => (
              <Paper key={`stat-${i}`} withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Skeleton h={16} w={96} />
                  <Skeleton h={28} w={128} />
                  <Skeleton h={12} w={80} />
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        )}

        {searchBar && (
          <Group justify="space-between">
            <Skeleton h={36} maw={448} style={{ flex: 1 }} />
            <Group gap="xs">
              <Skeleton h={36} w={112} />
              <Skeleton h={36} w={112} />
            </Group>
          </Group>
        )}

        {rows > 0 && (
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <TableSkeleton rows={rows} columns={columns} />
          </Paper>
        )}
      </PageContent>
    </PageShell>
  );
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
}

/** Renders inside an existing Card to skeleton-load just the table area. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  showHeader = true,
  className,
}: TableSkeletonProps): React.ReactElement {
  return (
    <Table.ScrollContainer minWidth={0} type="native" className={className}>
      <Table verticalSpacing="md">
        {showHeader && (
          <Table.Thead>
            <Table.Tr>
              {Array.from({ length: columns }).map((_, i) => (
                <Table.Th key={`th-${i}`}>
                  <Skeleton h={16} w={80} />
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
        )}
        <Table.Tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <Table.Tr key={`tr-${r}`}>
              {Array.from({ length: columns }).map((_, c) => (
                <Table.Td key={`td-${r}-${c}`}>
                  <Skeleton
                    h={16}
                    w={c === 0 ? 128 : c === columns - 1 ? 64 : 96}
                    ml={c === columns - 1 ? 'auto' : undefined}
                  />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

interface DetailSkeletonProps {
  /** Number of card sections to render. */
  sections?: number;
  className?: string;
}

/** Full-page skeleton for detail/view pages. */
export function DetailSkeleton({
  sections = 3,
  className,
}: DetailSkeletonProps): React.ReactElement {
  return (
    <PageShell className={className}>
      <Stack gap="xs">
        <Skeleton h={32} w={80} mb={4} />
        <Skeleton h={28} w={256} />
        <Skeleton h={16} w={320} />
      </Stack>
      <PageContent>
        {Array.from({ length: sections }).map((_, i) => (
          <Paper key={`sec-${i}`} withBorder radius="md" p="lg">
            <Stack gap="sm">
              <Skeleton h={20} w={160} mb="xs" />
              <Skeleton h={16} maw={448} />
              <Skeleton h={16} maw={384} />
              <Skeleton h={16} maw={512} />
              {i % 2 === 0 && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} pt="xs">
                  <Skeleton h={48} />
                  <Skeleton h={48} />
                </SimpleGrid>
              )}
            </Stack>
          </Paper>
        ))}
      </PageContent>
    </PageShell>
  );
}

/** Just the spinner-replacement: a centered set of rectangle skeletons. */
export function InlineLoadingSkeleton({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}): React.ReactElement {
  return (
    <Stack gap="sm" p="lg" className={className}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={16} w={i % 3 === 0 ? '100%' : i % 3 === 1 ? '80%' : '66%'} />
      ))}
    </Stack>
  );
}
