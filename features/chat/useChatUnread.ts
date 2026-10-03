'use client';

import { useEffect, useState } from 'react';

/** Polls the unread-message count for HR/Faculty. Returns 0 for other roles. */
export function useChatUnread(enabled: boolean, intervalMs = 10000): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/chat/unread');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setUnread(data.unread || 0);
      } catch {
        // ignore transient network errors
      }
    }
    poll();
    const t = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [enabled, intervalMs]);

  return enabled ? unread : 0;
}
