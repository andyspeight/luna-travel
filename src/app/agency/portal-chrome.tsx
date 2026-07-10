'use client';

/**
 * Shared chrome for the Luna-native agency portal (no Travelgenix SSO).
 *
 * AgencyShell fetches /api/agency/me once, then renders either:
 *   - a loading state,
 *   - a "signed out" card (no/expired lt_agency_session) telling the agency to
 *     ask their Luna contact for a fresh access link, or
 *   - the portal chrome (header + nav + Sign out) with the page's children,
 *     exposing the loaded agency via useAgencyMe().
 *
 * Styling is deliberately neutral (slate/indigo), independent of the traveller
 * app's per-booking brand tokens, so the portal looks stable for every agency.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface AgencyMe {
  agency: { id: string; name: string; legalName: string; contactEmail: string | null; email: string };
  branding: {
    appName?: string;
    logoUrl?: string;
    brandPrimaryColour?: string;
    brandAccentColour?: string;
    welcomeMessage?: string;
  };
}

const AgencyContext = createContext<{ me: AgencyMe; refresh: () => Promise<void> } | null>(null);

export function useAgencyMe() {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error('useAgencyMe must be used inside AgencyShell');
  return ctx;
}

type NavKey = 'overview' | 'branding' | 'access';
const NAV: { key: NavKey; label: string; href: string }[] = [
  { key: 'overview', label: 'Overview', href: '/agency' },
  { key: 'branding', label: 'App branding', href: '/agency/branding' },
  { key: 'access', label: 'Send access', href: '/agency/access' },
];

export function AgencyShell({ active, children }: { active: NavKey; children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'out' | 'in'>('loading');
  const [me, setMe] = useState<AgencyMe | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/me', { cache: 'no-store' });
      if (!res.ok) {
        setState('out');
        return;
      }
      const data = (await res.json()) as AgencyMe;
      setMe(data);
      setState('in');
    } catch {
      setState('out');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signOut = async () => {
    try {
      await fetch('/api/agency/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    router.replace('/agency');
    setState('out');
  };

  if (state === 'loading') {
    return (
      <Screen>
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading…</p>
      </Screen>
    );
  }

  if (state === 'out' || !me) {
    return (
      <Screen>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Agency portal</div>
          <p style={{ color: '#475569', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            You&rsquo;re signed out. Agency access uses a one-time link — ask your Luna Travel
            contact to send you a fresh sign-in link.
          </p>
        </div>
      </Screen>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <header
        style={{
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {me.agency.name}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Luna Travel · agency portal</div>
        </div>
        <button type="button" onClick={signOut} style={ghostBtn}>
          Sign out
        </button>
      </header>

      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 12px', display: 'flex', gap: 4, overflowX: 'auto' }}>
        {NAV.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            style={{
              padding: '12px 14px',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color: active === n.key ? '#4f46e5' : '#64748b',
              borderBottom: active === n.key ? '2px solid #4f46e5' : '2px solid transparent',
              textDecoration: 'none',
            }}
          >
            {n.label}
          </Link>
        ))}
      </nav>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 64px' }}>
        <AgencyContext.Provider value={{ me, refresh: load }}>{children}</AgencyContext.Provider>
      </main>
    </div>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 24,
  maxWidth: 380,
  width: '100%',
  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
};

const ghostBtn: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  background: '#fff',
  color: '#475569',
  fontSize: 13,
  fontWeight: 600,
  padding: '7px 12px',
  borderRadius: 8,
  cursor: 'pointer',
};
