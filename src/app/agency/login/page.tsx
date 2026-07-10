'use client';

/**
 * /agency/login?token=… — exchanges a magic-link token for a session.
 *
 * The link an operator sends lands here. We POST the token to
 * /api/agency/login, which sets the lt_agency_session cookie, then send the
 * agency on to the portal. No token, or an invalid/expired one, shows a clear
 * "ask for a fresh link" message rather than a dead end.
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('missing');
      return;
    }
    // Strip the token from the address bar/history right away. It's single-use,
    // but this keeps it out of browser history and any Referer once it's read.
    try {
      window.history.replaceState(null, '', '/agency/login');
    } catch {
      /* noop */
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agency/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        if (res.ok) {
          router.replace('/agency');
        } else {
          setError('invalid');
        }
      } catch {
        if (!cancelled) setError('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params, router]);

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

export default function AgencyLoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f8fafc' }} />}>
      <LoginInner />
    </Suspense>
  );
}
