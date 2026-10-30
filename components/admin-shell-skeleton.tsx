import { AppShell, Group, Skeleton, Stack } from '@mantine/core';
import { PageSkeleton } from '@/components/skeletons';

/** 로그인 확인 중에 보여주는 화면 틀 — 사이드바·헤더·페이지 자리를 미리 그린다 */
export function AdminShellSkeleton(): React.ReactElement {
  return (
    <AppShell
      layout="alt"
      withBorder={false}
      header={{ height: 70 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: true } }}
    >
      <AppShell.Header style={{ boxShadow: 'var(--app-shadow-soft)' }} />
      <AppShell.Navbar bg="var(--app-sidebar-bg)" p="md">
        <Stack gap="lg" mt={8}>
          <Group gap="sm">
            <Skeleton h={36} w={36} radius="md" opacity={0.15} />
            <Skeleton h={14} w={100} opacity={0.15} />
          </Group>
          <Stack gap="sm" mt="md">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} h={14} w={i % 3 === 0 ? 120 : 160} opacity={0.15} />
            ))}
          </Stack>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main bg="var(--app-bg-muted)">
        <PageSkeleton />
      </AppShell.Main>
    </AppShell>
  );
}
