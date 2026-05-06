'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Users,
  LogOut,
  Settings,
  Bell,
  Palette,
  Building2,
  UserCog,
  MessageSquare,
  Megaphone,
  LayoutList,
  Briefcase,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  ShieldAlert,
  Sparkles,
  Tag,
  type LucideIcon,
} from 'lucide-react';
import { logout, getCurrentUser, getUserRoles } from '@/lib/auth';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

// 메뉴별 badgeKey 매핑
const BADGE_KEYS: Record<string, string> = {
  '/admin/users': 'users',
  '/admin/user-reconfirm': 'user_reconfirm',
  '/admin/inquiries': 'inquiries',
  '/admin/managers': 'managers',
  '/admin/advertising-v2/applications': 'ad_applications',
  '/admin/advertising-v2/premium': 'premium_applications',
};

const LAST_READ_PREFIX = 'lastRead_';

interface MenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles: string[];
}

// ─── 관리 ──────────────────────────────────────────────────
const navigationItems: MenuItem[] = [
  {
    name: '아파트 관리',
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
];

// ─── 광고 시스템 ───────────────────────────────────────────
const advertisingItems: MenuItem[] = [
  {
    name: '광고 신청 관리',
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
    name: '홈 섹션 관리',
    href: '/admin/advertising/categories',
    icon: LayoutList,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '광고주 관리',
    href: '/admin/advertising/advertisers',
    icon: Building2,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '광고 등록/수정',
    href: '/admin/advertising/ads',
    icon: Megaphone,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '배너 광고 등록/수정',
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
    name: '알림 관리',
    href: '/admin/settings/notifications',
    icon: Bell,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '공지사항 관리',
    href: '/admin/settings/announcements',
    icon: FileText,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '다이얼로그 설정',
    href: '/admin/settings/dialog-messages',
    icon: MessageSquare,
    roles: ['SUPER_ADMIN'],
  },
];

interface NewCounts {
  inquiries: number;
  users: number;
  user_reconfirm: number;
  managers: number;
  ad_applications: number;
  premium_applications: number;
}

const INITIAL_COUNTS: NewCounts = {
  inquiries: 0,
  users: 0,
  user_reconfirm: 0,
  managers: 0,
  ad_applications: 0,
  premium_applications: 0,
};

interface SidebarUser {
  name: string;
  email: string | null;
}

export function AppSidebar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [user, setUser] = useState<SidebarUser | null>(null);
  const [newCounts, setNewCounts] = useState<NewCounts>(INITIAL_COUNTS);

  const supabase = createClient();

  const getLastReadTimes = useCallback((): Record<string, string | null> => {
    if (typeof window === 'undefined') return {};
    return {
      inquiries: localStorage.getItem(`${LAST_READ_PREFIX}inquiries`),
      users: localStorage.getItem(`${LAST_READ_PREFIX}users`),
      user_reconfirm: localStorage.getItem(`${LAST_READ_PREFIX}user_reconfirm`),
      managers: localStorage.getItem(`${LAST_READ_PREFIX}managers`),
    };
  }, []);

  const fetchNewCounts = useCallback(async (): Promise<void> => {
    try {
      const lastReadTimes = getLastReadTimes();

      const [
        menuCountsResult,
        adApplicationsResult,
        premiumApplicationsResult,
      ] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.rpc as any)('get_menu_new_counts', {
          p_last_read_inquiries: lastReadTimes.inquiries || null,
          p_last_read_users: lastReadTimes.users || null,
          p_last_read_user_reconfirm: lastReadTimes.user_reconfirm || null,
          p_last_read_managers: lastReadTimes.managers || null,
        }),
        supabase
          .from('advertisements_v2')
          .select('id', { count: 'exact', head: true })
          .eq('adStatus', 'pending'),
        supabase
          .from('premium_advertisements_v2')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      if (menuCountsResult.error) {
        console.error('Failed to fetch new counts:', menuCountsResult.error);
        return;
      }

      if (menuCountsResult.data) {
        setNewCounts({
          ...(menuCountsResult.data as NewCounts),
          ad_applications: adApplicationsResult.count ?? 0,
          premium_applications: premiumApplicationsResult.count ?? 0,
        });
      }
    } catch (err) {
      console.error('Failed to fetch new counts:', err);
    }
  }, [supabase, getLastReadTimes]);

  const handleMenuClick = (href: string): void => {
    const badgeKey = BADGE_KEYS[href];
    if (badgeKey && typeof window !== 'undefined') {
      localStorage.setItem(`${LAST_READ_PREFIX}${badgeKey}`, new Date().toISOString());
      setNewCounts((prev) => ({ ...prev, [badgeKey]: 0 }));
    }
    if (isMobile) setOpenMobile(false);
    router.push(href);
  };

  useEffect(() => {
    const fetchProfile = async (): Promise<void> => {
      const [roles, current] = await Promise.all([getUserRoles(), getCurrentUser()]);
      setUserRoles(roles);
      if (current) {
        setUser({ name: current.name, email: current.email ?? null });
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    fetchNewCounts();
    const interval = setInterval(fetchNewCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchNewCounts]);

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  const hasAccess = (requiredRoles: string[]): boolean => {
    return requiredRoles.some((role) => userRoles.includes(role));
  };

  const getBadgeCount = (href: string): number => {
    const badgeKey = BADGE_KEYS[href];
    if (!badgeKey) return 0;
    return newCounts[badgeKey as keyof NewCounts] || 0;
  };

  const renderMenuGroup = (
    label: string,
    items: MenuItem[]
  ): React.ReactElement | null => {
    const visible = items.filter((item) => hasAccess(item.roles));
    if (visible.length === 0) return null;
    return (
      <SidebarGroup className="px-2 py-2">
        <SidebarGroupLabel className="mb-1 px-2 font-semibold uppercase tracking-wider text-sidebar-foreground/55">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {visible.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const badgeCount = getBadgeCount(item.href);

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => handleMenuClick(item.href)}
                    tooltip={item.name}
                    className={cn(
                      'h-12 rounded-lg px-3.5 pr-10 transition-colors duration-150 [&>span]:leading-none',
                      'data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
                      'data-[active=true]:font-semibold data-[active=true]:shadow-sm',
                      'data-[active=true]:hover:bg-primary/90 data-[active=true]:hover:text-primary-foreground',
                      'data-[active=true]:active:bg-primary data-[active=true]:active:text-primary-foreground'
                    )}
                  >
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                  {badgeCount > 0 && (
                    <SidebarMenuBadge
                      className={cn(
                        'top-3.5! bg-destructive text-white tabular-nums',
                        isActive && 'bg-white/25 text-white'
                      )}
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold tracking-tight">Wooldanji</span>
            <span className="truncate text-xs text-muted-foreground">관리자 콘솔</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 py-2">
        {renderMenuGroup('관리', navigationItems)}
        {renderMenuGroup('파트너', partnerItems)}
        {renderMenuGroup('광고 시스템', advertisingItems)}
        {renderMenuGroup('콘텐츠 관리', settingsItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={user?.name ?? '계정'}
              className="h-auto cursor-default hover:bg-transparent active:bg-transparent"
              asChild
            >
              <div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground">
                  {user?.name?.charAt(0) ?? '?'}
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-medium">{user?.name ?? '...'}</span>
                  {user?.email && (
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  )}
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="로그아웃"
              onClick={handleLogout}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut />
              <span>로그아웃</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
