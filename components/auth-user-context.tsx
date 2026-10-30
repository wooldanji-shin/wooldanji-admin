'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/** 관리자 화면 전체가 함께 쓰는 로그인 사용자 — AuthGuard가 한 번만 확인해서 내려준다 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

const AuthUserContext = createContext<AuthUser | null>(null);

export function AuthUserProvider({ value, children }: { value: AuthUser; children: ReactNode }): React.ReactElement {
  return <AuthUserContext.Provider value={value}>{children}</AuthUserContext.Provider>;
}

/** AuthGuard 안에서만 쓴다 (밖에서 부르면 오류) */
export function useAuthUser(): AuthUser {
  const user = useContext(AuthUserContext);
  if (!user) throw new Error('useAuthUser must be used inside AuthGuard');
  return user;
}
