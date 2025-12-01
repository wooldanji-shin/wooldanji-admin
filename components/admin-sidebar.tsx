'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { logout, getUserRoles } from '@/lib/auth';
import { useState, useEffect } from 'react';

const navigationItems = [
  {
    name: '대시보드',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'APT_ADMIN', 'MANAGER'],
  },
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
    name: '문의 관리',
    href: '/admin/inquiries',
    icon: HelpCircle,
    roles: ['SUPER_ADMIN', 'MANAGER'],
  },
  {
    name: '관리자 관리',
    href: '/admin/managers',
    icon: UserCog,
    roles: ['SUPER_ADMIN'],
  },
  {
    name: '매니저 관리',
    href: '/admin/advertising/managers',
    icon: Briefcase,
    roles: ['SUPER_ADMIN'],
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
    name: '광고 등록/수정',
    href: '/admin/advertising/ads',
    icon: Megaphone,
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

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdvertisingOpen, setIsAdvertisingOpen] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchRoles = async () => {
      const roles = await getUserRoles();
      setUserRoles(roles);
    };
    fetchRoles();
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  const hasAccess = (requiredRoles: string[]) => {
    return requiredRoles.some(role => userRoles.includes(role));
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

          return (
            <Button
              key={item.name}
              variant='ghost'
              className={cn(
                'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive &&
                  'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
              )}
              onClick={() => router.push(item.href)}
            >
              <Icon className='h-5 w-5' />
              {item.name}
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
              광고 시스템
              <ChevronDown
                className={cn(
                  'ml-auto h-4 w-4 transition-transform duration-200',
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
