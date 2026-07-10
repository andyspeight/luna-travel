'use client';

/**
 * /agency/login?token=… — exchanges a magic-link token for a session.
 *
 * The link an operator sends lands here. We read the token ONCE from the URL,
 * POST it to /api/agency/login (which sets the lt_agency_session cookie), then
 * send the agency on to the portal. No token, or an invalid/expired one, shows
 * a clear "ask for a fresh link" message rather than a dead end.
 *
 * We read the token from window.location (not the reactive useSearchParams) and
 * run exactly once (ran-ref guard). That way, stripping the token from the URL
 * afterwards can't cause the effect to re-read an empty URL and mis-report the
 * link as "missing".
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AgencyLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against a double-invoke (e.g. StrictMode)
    ran.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('missing');
      return;
    }

    // Capture done — strip the token from the address bar/history. Safe now:
    // nothing re-reads the URL after this point.
    try {
      window.history.replaceState(null, '', '/agency/login');
    } catch {
      /* noop */
    }

    (async () => {
      try {
        const res = await fetch('/api/agency/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          router.replace('/agency');
        } else {
          setError('invalid');
        }
      } catch {
        setError('invalid');
      }
    })();
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 1px 3px rgba(15,23,42,0.06)' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Luna Travel</div>
        {!error ? (
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 10 }}>Signing you in…</p>
        ) : (
          <p style={{ color: '#475569', fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
            {error === 'missing'
              ? 'This link is missing its sign-in code.'
              : 'This sign-in link is invalid or has expired.'}{' '}
            Ask your Luna Travel contact to send you a fresh access link.
          </p>
        )}
      </div>
    </div>
  );
}
