import type { ReactNode } from 'react';
import { AuthFooter } from './AuthFooter';

export type AuthVariant = 'login' | 'register' | 'recover';

interface AuthLayoutProps {
  variant: AuthVariant;
  nav: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ variant, nav, children }: AuthLayoutProps) {
  return (
    <div className={`auth-page auth-page--${variant}`}>
      {nav}
      {children}
      <AuthFooter />
    </div>
  );
}
