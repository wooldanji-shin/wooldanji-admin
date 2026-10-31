'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  AppShell,
  Avatar,
  Burger,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  Users,
  LogOut,
  Bell,
  Palette,
  Building2,
  UserCog,
  MessageSquare,
  Megaphone,
  Briefcase,
  HelpCircle,
  Image as ImageIcon,
  ShieldAlert,
  Sparkles,
  Tag,
  DoorOpen,
  TrendingUp,
  Receipt,
  BookText,
  PartyPopper,
  type LucideIcon,
  ChevronRight,
} from 'lucide-react';
import { logout } from '@/lib/auth';
import { useState, useEffect } from 'react';
import { useAuthUser } from '@/components/auth-user-context';
import classes from './app-sidebar.module.css';

interface MenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

// ─── 관리 ──────────────────────────────────────────────────
const navigationItems: MenuItem[] = [
  {
    name: '아파트 등록/설정',
    href: '/admin/apartments',
    icon: Building2,
    roles: ['SUPER_ADMIN', 'APT_ADMIN', 'MANAGER'],
  },
  {
    name: '회원관리',
    href: '/admin/users',
    icon: Users,
    roles: ['SUPER_ADMIN', 'APT_ADMIN', 'MANAGER'],
  },
  {
    name: '관리자 관리',
    href: '/admin/managers',
    icon: UserCog,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '매니저 관리',
    href: '/admin/advertising/managers',
    icon: Briefcase,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '승인보류/거절 관리',
    href: '/admin/user-reconfirm',
    icon: ShieldAlert,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '문의 관리',
    href: '/admin/inquiries',
    icon: HelpCircle,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '회원 알림 발송',
    href: '/admin/user-announcements',
    icon: Bell,
    roles: ['SUPER_ADMIN', 'APT_ADMIN', 'MANAGER'],
  },
];

// ─── 파트너 ────────────────────────────────────────────────
const partnerItems: MenuItem[] = [
  {
    name: '파트너 회원 관리',
    href: '/admin/partners',
    icon: Users,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '쿠폰 관리',
    href: '/admin/coupons',
    icon: Tag,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '파트너 문의 관리',
    href: '/admin/partner-inquiries',
    icon: HelpCircle,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '파트너 안내 배너',
    href: '/admin/partner-banners',
    icon: Megaphone,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '파트너 공지 발송',
    href: '/admin/partner-announcements',
    icon: Bell,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '상호명 관리',
    href: '/admin/business-names',
    icon: BookText,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '이벤트 관리',
    href: '/admin/partner-events',
    icon: PartyPopper,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
];

// ─── 광고 시스템 ───────────────────────────────────────────
const advertisingItems: MenuItem[] = [
  {
    name: '기본광고 관리',
    href: '/admin/advertising-v2/applications',
    icon: ShieldAlert,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '프리미엄 광고 관리',
    href: '/admin/advertising-v2/premium',
    icon: Sparkles,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '단독 팝업 광고 관리',
    href: '/admin/advertising-v2/solo-popup',
    icon: DoorOpen,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '가격 변동하기',
    href: '/admin/advertising-v2/pricing',
    icon: TrendingUp,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '정산 관리',
    href: '/admin/settlement',
    icon: Receipt,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '영업 담당자 관리',
    href: '/admin/advertising-v2/sales-reps',
    icon: Briefcase,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '광고 소개 이미지',
    href: '/admin/partner-ad-intro-image',
    icon: ImageIcon,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '단독 팝업 소개 이미지',
    href: '/admin/solo-popup-ad-intro-image',
    icon: ImageIcon,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
];

// ─── 홈화면 수정 ───────────────────────────────────────────
const homeSettingsItems: MenuItem[] = [
  {
    name: '카테고리 관리',
    href: '/admin/advertising-v2/categories',
    icon: Tag,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '공동현관문 팝업관리',
    href: '/admin/advertising-v2/door-banner',
    icon: DoorOpen,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '문열림 채움 이미지',
    href: '/admin/advertising-v2/door-filler-images',
    icon: ImageIcon,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '문열림 팝업 통계',
    href: '/admin/advertising-v2/door-popup-stats',
    icon: DoorOpen,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '배너 등록/수정',
    href: '/admin/settings/banners',
    icon: ImageIcon,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
];

// ─── 콘텐츠 관리 ───────────────────────────────────────────
const settingsItems: MenuItem[] = [
  {
    name: '헤더 설정',
    href: '/admin/settings/header',
    icon: Palette,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '다이얼로그 설정',
    href: '/admin/settings/dialog-messages',
    icon: MessageSquare,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '사용법·FAQ 이미지',
    href: '/admin/faq-images',
    icon: ImageIcon,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
];

// ─── V1 시스템 관리 ────────────────────────────────────────
const v1Items: MenuItem[] = [
  {
    name: '비활성 아파트 첫 화면',
    href: '/admin/settings/notifications',
    icon: Bell,
    roles: ['SUPER_ADMIN'],
  },
];

interface MenuSection {
  label: string;
  items: MenuItem[];
}

const MENU_SECTIONS: MenuSection[] = [
  { label: '아파트 관리', items: navigationItems },
  { label: '파트너', items: partnerItems },
  { label: '광고 시스템', items: advertisingItems },
  { label: '홈화면 수정', items: homeSettingsItems },
  { label: '콘텐츠 관리', items: settingsItems },
  { label: 'V1 시스템 관리', items: v1Items },
];

interface SidebarUser {
  name: string;
  email: string | null;
}

interface AppSidebarProps {
  /** 데스크톱에서 사이드바를 접었을 때 — 아이콘만 표시하고 이름은 툴팁으로 보여준다 */
  collapsed: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({ collapsed, onCloseMobile }: AppSidebarProps): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  // 로그인 사용자·권한은 AuthGuard가 확인한 값을 함께 쓴다 (다시 조회하지 않음)
  const authUser = useAuthUser();
  const userRoles = authUser.roles;
  const user: SidebarUser = { name: authUser.name, email: authUser.email || null };
  // 펼쳐 둔 사이드바 섹션 — 현재 페이지가 속한 섹션은 자동으로 펼친다
  const [openedSections, setOpenedSections] = useState<string[]>(() => {
    const current = MENU_SECTIONS.find((section) =>
      section.items.some((item) => item.href === pathname)
    );
    return current ? [current.label] : [];
  });

  useEffect(() => {
    const current = MENU_SECTIONS.find((section) =>
      section.items.some((item) => item.href === pathname)
    );
    if (current) {
      setOpenedSections((prev) => (prev.includes(current.label) ? prev : [...prev, current.label]));
    }
  }, [pathname]);

  const toggleSection = (label: string): void => {
    setOpenedSections((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleMenuClick = (href: string): void => {
    onCloseMobile();
    router.push(href);
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  const hasAccess = (requiredRoles: string[]): boolean => {
    return requiredRoles.some((role) => userRoles.includes(role));
  };

  const renderMenuGroup = (
    label: string,
    items: MenuItem[]
  ): React.ReactElement | null => {
    const visible = items.filter((item) => hasAccess(item.roles));
    if (visible.length === 0) return null;

    const menuItems = (
      <>
        {visible.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Tooltip
              key={item.href}
              label={item.name}
              position="right"
              disabled={!collapsed}
              withArrow
            >
              <NavLink
                component="button"
                active={isActive}
                onClick={() => handleMenuClick(item.href)}
                aria-label={collapsed ? item.name : undefined}
                label={collapsed ? undefined : item.name}
                // 펼친 상태에서는 아이콘 없이 메뉴 이름만, 접힌 상태(아이콘만 보이는 좁은 바)에서만 아이콘을 쓴다
                leftSection={
                  collapsed ? (
                    <Icon size={18} strokeWidth={1.75} className={classes.icon} />
                  ) : undefined
                }
                classNames={{ root: classes.link }}
              />
            </Tooltip>
          );
        })}
      </>
    );

    // 접힌 사이드바(아이콘만): 섹션 구분선 + 아이콘 메뉴
    if (collapsed) {
      return (
        <Stack gap={2}>
          <Divider my="xs" className={classes.divider} />
          {menuItems}
        </Stack>
      );
    }

    // 펼친 사이드바: 섹션 제목을 눌러 메뉴를 접고 펼친다
    const isOpen = openedSections.includes(label);
    const hasActive = visible.some((item) => item.href === pathname);

    return (
      <NavLink
        component="button"
        label={label}
        opened={isOpen}
        onChange={() => toggleSection(label)}
        childrenOffset={0}
        disableRightSectionRotation
        rightSection={
          <ChevronRight
            size={16}
            className={classes.sectionChevron}
            data-opened={isOpen || undefined}
          />
        }
        data-section-active={hasActive || undefined}
        classNames={{ root: classes.section, label: classes.sectionLabel, children: classes.sectionChildren }}
        mt={4}
      >
        {menuItems}
      </NavLink>
    );
  };

  return (
    <>
      <AppShell.Section px={collapsed ? 0 : 'md'} h={70} style={{ flexShrink: 0, borderBottom: '1px solid var(--app-sidebar-divider)' }}>
        <Group h="100%" justify={collapsed ? 'center' : 'space-between'} wrap="nowrap">
          {/* 로고 아이콘 없이 이름만 — 접힌 70px 레일에서는 좌우 여백을 없애 한 줄로 */}
          <div>
            <Text fw={700} lh={1.2} c="var(--app-sidebar-active)" style={{ whiteSpace: 'nowrap' }}>울단지</Text>
            {!collapsed && <Text size="xs" lh={1.2} c="var(--app-sidebar-text)">관리자 콘솔</Text>}
          </div>
          <Burger opened onClick={onCloseMobile} hiddenFrom="sm" size="sm" color="var(--app-sidebar-text)" aria-label="메뉴 닫기" />
        </Group>
      </AppShell.Section>

      {/* 스크롤은 되지만 스크롤바는 보이지 않게 */}
      <AppShell.Section grow component={ScrollArea} scrollbars="y" type="never" px="sm" pb="md">
        {renderMenuGroup('아파트 관리', navigationItems)}
        {renderMenuGroup('파트너', partnerItems)}
        {renderMenuGroup('광고 시스템', advertisingItems)}
        {renderMenuGroup('홈화면 수정', homeSettingsItems)}
        {renderMenuGroup('콘텐츠 관리', settingsItems)}
        {renderMenuGroup('V1 시스템 관리', v1Items)}
      </AppShell.Section>

      <AppShell.Section p="sm" style={{ flexShrink: 0, borderTop: '1px solid var(--app-sidebar-divider)' }}>
        <Tooltip label={user?.name ?? '계정'} position="right" disabled={!collapsed} withArrow>
          <Group gap="sm" px="xs" py={6} wrap="nowrap" justify={collapsed ? 'center' : undefined}>
            <Avatar radius="xl" color="blue">
              {user?.name?.charAt(0) ?? '?'}
            </Avatar>
            {!collapsed && (
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text size="sm" fw={600} truncate c="var(--app-sidebar-active)">
                  {user?.name ?? '...'}
                </Text>
                {user?.email && (
                  <Text size="xs" c="var(--app-sidebar-text)" truncate>
                    {user.email}
                  </Text>
                )}
              </div>
            )}
          </Group>
        </Tooltip>
        <Tooltip label="로그아웃" position="right" disabled={!collapsed} withArrow>
          <NavLink
            component="button"
            label={collapsed ? undefined : '로그아웃'}
            aria-label={collapsed ? '로그아웃' : undefined}
            leftSection={
              collapsed ? <LogOut size={18} strokeWidth={1.75} className={classes.icon} /> : undefined
            }
            onClick={handleLogout}
            classNames={{ root: classes.link }}
          />
        </Tooltip>
      </AppShell.Section>
    </>
  );
}
