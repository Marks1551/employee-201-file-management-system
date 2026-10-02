'use client';

import { Loader2 } from 'lucide-react';

/** Full-area spinner shown while the app is loading data, so the page never
 *  flashes empty/stale content before the real data arrives. */
export default function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[60vh] w-full flex flex-col items-center justify-center gap-3 text-ink-muted"
    >
      <Loader2 size={32} className="animate-spin text-navy" />
      <p className="text-[0.95rem] m-0">{message}</p>
    </div>
  );
}
