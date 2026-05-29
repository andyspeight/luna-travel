'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AgentLatest {
  id: string;
  subject: string | null;
  body: string;
  priority: string;
  sentAt: string;
}

export interface AgentSummary {
  unreadCount: number;
  latest: AgentLatest | null;
}

/**
 * Polls /api/traveller/messages/summary for the unread agent-message count and
 * a preview of the newest unread one. Refetches on mount, on window focus, on
 * tab visibility, and whenever a 'lt:messages-changed' event fires (the
 * Notifications screen dispatches that after it marks messages read, so badges
 * clear immediately). Side-effect-free: reading the count never marks read.
 */
export function useAgentMessages(): AgentSummary & { refresh: () => void } {
  const [summary, setSummary] = useState<AgentSummary>({ unreadCount: 0, latest: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/traveller/messages/summary', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setSummary({
        unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
        latest: data.latest ?? null,
      });
    } catch {
      /* ignore — a transient failure just keeps the last known count */
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onChanged = () => refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('lt:messages-changed', onChanged);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('lt:messages-changed', onChanged);
    };
  }, [refresh]);

  return { unreadCount: summary.unreadCount, latest: summary.latest, refresh };
}
