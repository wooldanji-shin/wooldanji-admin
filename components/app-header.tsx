'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, User as UserIcon } from 'lucide-react';
import {
  ActionIcon,
  Anchor,
  Avatar,
  Breadcrumbs,
  Burger,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { logout } from '@/lib/auth';
import { useAuthUser } from '@/components/auth-user-context';
import type { UseAdminShellReturn } from '@/components/useAdminShell';
import { ColorSchemeToggle } from '@/components/color-scheme-toggle';
import classes from './app-header.module.css';

const ROUTE_LABEL_MAP: Record<string, string> = {
  admin: '관리자',
  apartments: '아파트 관리',
  users: '회원 관리',
  managers: '관리자 관리',
  'user-reconfirm': '승인보류/거절',
  'user-announcements': '회원 알림 발송',
  inquiries: '문의 관리',
  'partner-inquiries': '파트너 문의',
  'partner-banners': '파트너 안내 배너',
  'partner-announcements': '파트너 공지 발송',
  devices: '기기',
  dashboard: '대시보드',
  'advertising-v2': '광고',
  'advertising': '광고',
  applications: '광고 신청',
  premium: '프리미엄 광고',
  ads: '광고 등록/수정',
  advertisers: '광고주',
  categories: '홈 섹션',
  settings: '설정',
  header: '헤더 설정',
  notifications: '알림',
  announcements: '공지사항',
  'dialog-messages': '다이얼로그',
  banners: '배너 광고',
  edit: '수정',
  view: '상세',
  new: '신규',
  advertisements: '광고 관리',
  'business-names': '상호명 관리',
  coupons: '쿠폰 관리',
  'design-system': '디자인 시스템',
  'door-banner': '공동현관문 팝업',
  'door-filler-images': '문열림 채움 이미지',
  'door-popup-stats': '문열림 팝업 통계',
  'faq-images': '사용법·FAQ 이미지',
  'membership-conversion': '회원 전환',
  'partner-ad-intro-image': '광고 소개 이미지',
  'partner-events': '이벤트 관리',
  partners: '파트너 회원',
  pricing: '가격 변동',
  'sales-reps': '영업 담당자',
  settlement: '정산 관리',
  'solo-popup': '단독 팝업 광고',
  'solo-popup-ad-intro-image': '단독 팝업 소개 이미지',
  user: '보류 회원',
};

interface Crumb {
  href: string;
  label: string;
  isLast: boolean;
}

function isLikelyId(segment: string): boolean {
  // UUID, numeric id, or 8+ char hex/alphanumeric
  if (/^[0-9]+$/.test(segment)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment))
    return true;
  if (segment.length >= 16 && /^[0-9a-zA-Z_-]+$/.test(segment) && /\d/.test(segment))
    return true;
  return false;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [];
  let acc = '';
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    if (seg === 'admin') return; // skip leading admin segment
    const label = ROUTE_LABEL_MAP[seg] ?? (isLikelyId(seg) ? '상세' : decodeURIComponent(seg));
    crumbs.push({
      href: acc,
      label,
      isLast: idx === segments.length - 1,
    });
  });
  return crumbs;
}

interface HeaderUser {
  name: string;
  email: string;
}

interface AppHeaderProps {
  shell: UseAdminShellReturn;
}

export function AppHeader({ shell }: AppHeaderProps): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  // 로그인 사용자는 AuthGuard가 확인한 값을 함께 쓴다 (다시 조회하지 않음)
  const authUser = useAuthUser();
  const user: HeaderUser | null = { name: authUser.name, email: authUser.email };

  const crumbs = useMemo<Crumb[]>(() => buildCrumbs(pathname), [pathname]);

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <Group h="100%" px="md" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap" miw={0}>
        <Burger
          opened={shell.mobileOpened}
          onClick={shell.toggleMobile}
          hiddenFrom="sm"
          size="sm"
          aria-label="메뉴 열기"
        />
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          onClick={shell.toggleDesktop}
          visibleFrom="sm"
          aria-label={shell.desktopOpened ? '사이드바 접기' : '사이드바 펼치기'}
        >
          {shell.desktopOpened ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </ActionIcon>
        {/* 상세 페이지 제목 자리 (HeaderTitle이 채움) — 채워지면 아래 브레드크럼은 숨는다 */}
        <div id="app-header-title" className={classes.titleSlot} style={{ minWidth: 0 }} />
        <div className={classes.crumbs} style={{ minWidth: 0 }}>
        {/* 휴대폰: 현재 페이지 이름만 */}
        <Text size="sm" fw={600} truncate hiddenFrom="sm" aria-current="page">
          {crumbs[crumbs.length - 1]?.label ?? '관리자'}
        </Text>
        <Breadcrumbs
          visibleFrom="sm"
          component="nav"
          aria-label="breadcrumb"
          separatorMargin={6}
          style={{ flexWrap: 'nowrap', minWidth: 0 }}
        >
          <Anchor
            component="button"
            onClick={() => router.push('/admin/apartments')}
            c="dimmed"
            size="sm"
          >
            관리자
          </Anchor>
          {crumbs.map((c) =>
            c.isLast ? (
              <Text key={c.href} size="sm" fw={600} truncate aria-current="page">
                {c.label}
              </Text>
            ) : (
              <Anchor
                key={c.href}
                component="button"
                onClick={() => router.push(c.href)}
                c="dimmed"
                size="sm"
              >
                {c.label}
              </Anchor>
            )
          )}
        </Breadcrumbs>
        </div>
      </Group>

      <Group gap="sm" wrap="nowrap">
      <ColorSchemeToggle />
      <Menu position="bottom-end" width={224} shadow="md">
        <Menu.Target>
          <UnstyledButton>
            <Group gap="xs" wrap="nowrap">
              <Avatar size="sm" radius="xl" color="blue">
                {user?.name?.charAt(0) ?? '?'}
              </Avatar>
              <Text size="sm" fw={500} visibleFrom="sm">
                {user?.name ?? '...'}
              </Text>
              <ChevronDown size={14} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>
            <Text size="sm" fw={600} c="var(--mantine-color-text)">
              {user?.name ?? '관리자'}
            </Text>
            {user?.email && (
              <Text size="xs" c="dimmed" truncate>
                {user.email}
              </Text>
            )}
          </Menu.Label>
          <Menu.Divider />
          <Menu.Item disabled leftSection={<UserIcon size={16} />}>
            프로필
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<LogOut size={16} />} onClick={handleLogout}>
            로그아웃
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      </Group>
    </Group>
  );
}
