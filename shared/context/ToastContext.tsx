'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

type ShowToast = (message: string) => void;

interface Toast {
  id: number;
  message: string;
}

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback<ShowToast>((message) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 2800);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 items-center max-w-[90vw]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-navy-dark text-white px-5 py-3.5 rounded-xl font-medium text-[0.9rem] shadow-pop flex items-center gap-2 animate-[fadein_0.2s_ease]"
          >
            <CheckCircle2 size={18} className="text-gold flex-shrink-0" />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
