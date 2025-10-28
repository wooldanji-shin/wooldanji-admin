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
} from 'lucide-react';
import { logout } from '@/lib/auth';
import { useState } from 'react';

const navigation = [
  {
    name: '대시보드',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: '아파트 관리',
    href: '/admin/apartments',
    icon: Building2,
  },
  {
    name: '회원관리',
    href: '/admin/users',
    icon: Users,
  },
  {
    name: '관리자 관리',
    href: '/admin/managers',
    icon: UserCog,
  },
];

const settingsMenu = {
  name: '콘텐츠 관리',
  icon: Settings,
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
  ],
};

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className='flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border'>
      {/* Logo/Header */}
      <div className='flex h-16 items-center border-b border-sidebar-border px-6'>
        <h1 className='text-xl font-bold text-sidebar-foreground'>
          Wooldanji
        </h1>
      </div>

      {/* Navigation */}
      <nav className='flex-1 space-y-1 px-3 py-4'>
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

        <div className='space-y-1'>
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
