'use client';

/**
 * App-wide maintenance banner. Reads the public announcement endpoint on mount
 * and, if maintenance mode is on (admin Settings → kill switches), shows a
 * dismissible amber bar at the very top. Renders nothing when maintenance is off.
 */

import { useEffect, useState } from 'react';

const DEFAULT = 'We’re carrying out some maintenance — a few features may be briefly unavailable.';

export function MaintenanceBanner() {
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/traveller/announcement', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.maintenance?.enabled) setMessage(d.maintenance.message?.trim() || DEFAULT);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!message || dismissed) return null;

  return (
    <div
      role="status"
      style={{
        background: '#fef3c7',
        color: '#92400e',
        borderBottom: '1px solid #fde68a',
        fontSize: 13,
        lineHeight: 1.4,
        padding: '9px 40px 9px 16px',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {message}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          border: 'none',
          background: 'transparent',
          color: '#92400e',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 4,
        }}
      >
        ×
      </button>
    </div>
  );
}
