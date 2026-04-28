'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getCurrentUser, logout } from '@/lib/auth';
import { Fragment } from 'react';

const ROUTE_LABEL_MAP: Record<string, string> = {
  admin: '관리자',
  apartments: '아파트 관리',
  users: '회원 관리',
  managers: '관리자 관리',
  'user-reconfirm': '승인보류/거절',
  'membership-conversion': '멤버십 전환 신청',
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

export function AppHeader(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<HeaderUser | null>(null);

  const crumbs = useMemo<Crumb[]>(() => buildCrumbs(pathname), [pathname]);

  useEffect(() => {
    const fetchUser = async (): Promise<void> => {
      const current = await getCurrentUser();
      if (current) setUser({ name: current.name, email: current.email });
    };
    fetchUser();
  }, []);

  const handleLogout = async (): Promise<void> => {
    await logout();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:inline-flex">
            <BreadcrumbLink
              onClick={() => router.push('/admin/apartments')}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              관리자
            </BreadcrumbLink>
          </BreadcrumbItem>
          {crumbs.length > 0 && <BreadcrumbSeparator className="hidden md:block" />}
          {crumbs.map((c, idx) => (
            <Fragment key={c.href}>
              {idx > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {c.isLast ? (
                  <BreadcrumbPage className="font-medium text-foreground">
                    {c.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    onClick={() => router.push(c.href)}
                    className="cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    {c.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2 px-2 hover:bg-muted/60"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {user?.name?.charAt(0) ?? '?'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">
                {user?.name ?? '...'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-popover">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name ?? '관리자'}</span>
                {user?.email && (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="gap-2">
              <UserIcon className="h-4 w-4" />
              <span>프로필</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>로그아웃</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
