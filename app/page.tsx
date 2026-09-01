'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp, roleHome } from '@/shared/context/AppContext';
import Login from '@/features/auth/components/Login';

export default function Home() {
  const { currentUser, ready } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (ready && currentUser) router.replace(roleHome(currentUser.role));
  }, [ready, currentUser, router]);

  if (!ready || currentUser) return null;
  return <Login />;
}
