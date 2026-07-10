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
import { Wordmark, HERO_BG, P, SERIF, card } from '../portal-chrome';

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
    <div style={{ minHeight: '100vh', background: HERO_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ ...card, padding: 30, maxWidth: 380, width: '100%', textAlign: 'center' }} className="animate-slide-up">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Wordmark on="light" size={24} />
        </div>
        {!error ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
              <span
                className="animate-spin"
                style={{ width: 26, height: 26, borderRadius: 999, border: `2.5px solid ${P.line}`, borderTopColor: P.teal, display: 'inline-block' }}
              />
            </div>
            <p style={{ color: P.ink2, fontSize: 14, marginTop: 16 }}>Signing you in…</p>
          </>
        ) : (
          <>
            <div style={{ fontFamily: SERIF, fontSize: 22, color: P.ink, marginTop: 18 }}>
              {error === 'missing' ? 'Missing sign-in code' : 'Link expired'}
            </div>
            <p style={{ color: P.ink2, fontSize: 14, marginTop: 8, lineHeight: 1.55 }}>
              {error === 'missing'
                ? 'This link is missing its sign-in code.'
                : 'This sign-in link is invalid or has already been used.'}{' '}
              Ask your Luna Travel contact to send you a fresh access link.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
