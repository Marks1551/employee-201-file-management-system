'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, roleHome } from '@/shared/context/AppContext';
import type { Role } from '@/shared/types';

interface ProtectedRouteProps {
  role: Role;
  children?: ReactNode;
}

export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { currentUser, ready } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!currentUser) {
      router.replace('/');
    } else if (currentUser.role !== role) {
      router.replace(roleHome(currentUser.role));
    }
  }, [ready, currentUser, role, router]);

  if (!ready || !currentUser || currentUser.role !== role) return null;
  return children;
}
