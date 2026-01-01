'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  LogOut,
  Settings,
  ChevronDown,
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
  Image,
  ShieldAlert,
} from 'lucide-react';
import { logout, getUserRoles } from '@/lib/auth';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// 메뉴별 badgeKey 매핑
const BADGE_KEYS: Record<string, string> = {
  '/admin/users': 'users',
  '/admin/user-reconfirm': 'user_reconfirm',
  '/admin/inquiries': 'inquiries',
  '/admin/managers': 'managers',
};

// 로컬스토리지 키 접두사
const LAST_READ_PREFIX = 'lastRead_';

const navigationItems = [
  // {
  //   name: '대시보드',
  //   href: '/admin/dashboard',
  //   icon: LayoutDashboard,
  //   roles: ['SUPER_ADMIN', 'APT_ADMIN', 'MANAGER'],
  // },
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

const advertisingItems = [
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
    icon: Image,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
];

const settingsMenu = {
  name: '콘텐츠 관리',
  icon: Settings,
  roles: ['SUPER_ADMIN'],
  subItems: [
    {
      name: '헤더 설정',
      href: '/admin/settings/header',
      icon: Palette,
    },
    {
      name: '알림 관리',
      href: '/admin/settings/notifications',
      icon: Bell,
    },
    {
      name: '공지사항 관리',
      href: '/admin/settings/announcements',
      icon: FileText,
    },
    {
      name: '다이얼로그 설정',
      href: '/admin/settings/dialog-messages',
      icon: MessageSquare,
    },
  ],
};

interface NewCounts {
  inquiries: number;
  users: number;
  user_reconfirm: number;
  managers: number;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdvertisingOpen, setIsAdvertisingOpen] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [newCounts, setNewCounts] = useState<NewCounts>({
    inquiries: 0,
    users: 0,
    user_reconfirm: 0,
    managers: 0,
  });

  const supabase = createClient();

  // 로컬스토리지에서 lastRead 시간 가져오기
  const getLastReadTimes = useCallback(() => {
    if (typeof window === 'undefined') return {};

    return {
      inquiries: localStorage.getItem(`${LAST_READ_PREFIX}inquiries`),
      users: localStorage.getItem(`${LAST_READ_PREFIX}users`),
      user_reconfirm: localStorage.getItem(`${LAST_READ_PREFIX}user_reconfirm`),
      managers: localStorage.getItem(`${LAST_READ_PREFIX}managers`),
    };
  }, []);

  // 새 항목 개수 조회
  const fetchNewCounts = useCallback(async () => {
    try {
      const lastReadTimes = getLastReadTimes();

      const { data, error } = await (supabase.rpc as any)('get_menu_new_counts', {
        p_last_read_inquiries: lastReadTimes.inquiries || null,
        p_last_read_users: lastReadTimes.users || null,
        p_last_read_user_reconfirm: lastReadTimes.user_reconfirm || null,
        p_last_read_managers: lastReadTimes.managers || null,
      });

      if (error) {
        console.error('Failed to fetch new counts:', error);
        return;
      }

      if (data) {
        setNewCounts(data as NewCounts);
      }
    } catch (err) {
      console.error('Failed to fetch new counts:', err);
    }
  }, [supabase, getLastReadTimes]);

  // 메뉴 클릭 시 lastRead 시간 저장
  const handleMenuClick = (href: string) => {
    const badgeKey = BADGE_KEYS[href];
    if (badgeKey && typeof window !== 'undefined') {
      localStorage.setItem(`${LAST_READ_PREFIX}${badgeKey}`, new Date().toISOString());
      // 해당 메뉴의 카운트 초기화
      setNewCounts(prev => ({ ...prev, [badgeKey]: 0 }));
    }
    router.push(href);
  };

  useEffect(() => {
    const fetchRoles = async () => {
      const roles = await getUserRoles();
      setUserRoles(roles);
    };
    fetchRoles();
  }, []);

  // 새 항목 개수 조회 (마운트 시 + 주기적)
  useEffect(() => {
    fetchNewCounts();

    // 30초마다 새로고침
    const interval = setInterval(fetchNewCounts, 30000);
    return () => clearInterval(interval);
  }, [fetchNewCounts]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  const hasAccess = (requiredRoles: string[]) => {
    return requiredRoles.some(role => userRoles.includes(role));
  };

  // 메뉴별 뱃지 카운트 가져오기
  const getBadgeCount = (href: string): number => {
    const badgeKey = BADGE_KEYS[href];
    if (!badgeKey) return 0;
    return newCounts[badgeKey as keyof NewCounts] || 0;
  };

  const navigation = navigationItems.filter(item => hasAccess(item.roles));
  const advertisingMenu = advertisingItems.filter(item => hasAccess(item.roles));

  return (
    <div className='flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border'>
      {/* Logo/Header */}
      <div className='flex h-16 items-center border-b border-sidebar-border px-6'>
        <h1 className='text-xl font-bold text-sidebar-foreground'>
          Wooldanji
        </h1>
      </div>

      {/* Navigation */}
      <nav className='flex-1 space-y-1 px-3 py-4 overflow-y-auto'>
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const badgeCount = getBadgeCount(item.href);

          return (
            <Button
              key={item.name}
              variant='ghost'
              className={cn(
                'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive &&
                  'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
              )}
              onClick={() => handleMenuClick(item.href)}
            >
              <Icon className='h-5 w-5' />
              <span className='flex-1 text-left'>{item.name}</span>
              {badgeCount > 0 && (
                <Badge
                  variant='destructive'
                  className='h-5 min-w-5 px-1.5 text-xs font-medium'
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Badge>
              )}
            </Button>
          );
        })}

        {/* 광고 시스템 메뉴 */}
        {advertisingMenu.length > 0 && (
          <div className='space-y-1 pt-2'>
            <Button
              variant='ghost'
              className='w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              onClick={() => setIsAdvertisingOpen(!isAdvertisingOpen)}
            >
              <Megaphone className='h-5 w-5' />
              <span className='flex-1 text-left'>광고 시스템</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isAdvertisingOpen && 'rotate-180'
                )}
              />
            </Button>

            {/* Sub-items */}
            {isAdvertisingOpen && (
              <div className='ml-4 space-y-1 border-l-2 border-sidebar-border pl-2'>
                {advertisingMenu.map((subItem) => {
                  const isActive = pathname === subItem.href;
                  const SubIcon = subItem.icon;

                  return (
                    <Button
                      key={subItem.name}
                      variant='ghost'
                      size='sm'
                      className={cn(
                        'w-full justify-start gap-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive &&
                          'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
                      )}
                      onClick={() => router.push(subItem.href)}
                    >
                      <SubIcon className='h-4 w-4' />
                      {subItem.name}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 콘텐츠 관리 메뉴 */}
        {hasAccess(settingsMenu.roles) && (
          <div className='space-y-1 pt-2'>
            <Button
              variant='ghost'
              className='w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            >
              <Settings className='h-5 w-5' />
              {settingsMenu.name}
              <ChevronDown
                className={cn(
                  'ml-auto h-4 w-4 transition-transform duration-200',
                  isSettingsOpen && 'rotate-180'
                )}
              />
            </Button>

            {/* Sub-items */}
            {isSettingsOpen && (
              <div className='ml-4 space-y-1 border-l-2 border-sidebar-border pl-2'>
                {settingsMenu.subItems.map((subItem) => {
                  const isActive = pathname === subItem.href;
                  const SubIcon = subItem.icon;

                  return (
                    <Button
                      key={subItem.name}
                      variant='ghost'
                      size='sm'
                      className={cn(
                        'w-full justify-start gap-3 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                        isActive &&
                          'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
                      )}
                      onClick={() => router.push(subItem.href)}
                    >
                      <SubIcon className='h-4 w-4' />
                      {subItem.name}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Logout Button */}
      <div className='border-t border-sidebar-border p-3'>
        <Button
          variant='ghost'
          className='w-full justify-start gap-3 text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive'
          onClick={handleLogout}
        >
          <LogOut className='h-5 w-5' />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
