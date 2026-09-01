'use client';

import type { ReactNode } from 'react';
import { AppProvider } from '@/shared/context/AppContext';
import { ToastProvider } from '@/shared/context/ToastContext';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <ToastProvider>{children}</ToastProvider>
    </AppProvider>
  );
}
