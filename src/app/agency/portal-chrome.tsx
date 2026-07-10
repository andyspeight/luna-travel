'use client';

/**
 * Shared chrome + design system for the Luna-native agency portal (no SSO).
 *
 * AgencyShell fetches /api/agency/me once, then renders a loading state, a
 * "signed out" card, or the branded portal (night-sky navy hero + serif
 * wordmark + nav) with the page's children, exposing the agency via
 * useAgencyMe(). Styling uses Luna's own palette (navy/teal) and the Instrument
 * Serif display font, held locally so the portal looks stable and on-brand
 * regardless of the traveller app's per-booking theme.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutGrid, Palette, Send, LogOut } from 'lucide-react';

// ── Design tokens ────────────────────────────────────────────────────────────
export const P = {
  navyDeep: '#0d1836',
  navy: '#1b2b5b',
  navyLight: '#2a3f7a',
  teal: '#00b4d8',
  tealLight: '#5eead4',
  tealDark: '#0096b7',
  ink: '#0f172a',
  ink2: '#475569',
  ink3: '#94a3b8',
  bg: '#f5f8fd',
  surface: '#ffffff',
  line: '#e7ecf4',
};
export const SERIF = "var(--font-instrument), Georgia, 'Times New Roman', serif";
export const HERO_BG = `radial-gradient(120% 120% at 85% -10%, ${P.tealDark}66 0%, transparent 45%), linear-gradient(135deg, ${P.navyDeep} 0%, ${P.navy} 55%, ${P.navyLight} 100%)`;

export const card: React.CSSProperties = {
  background: P.surface,
  border: `1px solid ${P.line}`,
  borderRadius: 18,
  boxShadow: '0 6px 24px -12px rgba(15,23,42,0.18)',
};
export const primaryBtn: React.CSSProperties = {
  background: P.navy,
  color: '#fff',
  border: 'none',
  borderRadius: 11,
  padding: '11px 20px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 6px 16px -8px rgba(27,43,91,0.6)',
};
export const ghostBtn: React.CSSProperties = {
  border: `1px solid ${P.line}`,
  background: '#fff',
  color: P.ink2,
  fontSize: 13,
  fontWeight: 600,
  padding: '9px 14px',
  borderRadius: 10,
  cursor: 'pointer',
};

// ── Wordmark ─────────────────────────────────────────────────────────────────
export function Wordmark({ on = 'dark' as 'dark' | 'light', size = 20 }: { on?: 'dark' | 'light'; size?: number }) {
  const fg = on === 'dark' ? '#fff' : P.navy;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <span
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: 999,
          background: on === 'dark' ? 'rgba(94,234,212,0.16)' : `${P.teal}1a`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Moon size={size - 2} colour={on === 'dark' ? P.tealLight : P.teal} />
      </span>
      <span style={{ fontFamily: SERIF, fontSize: size + 4, fontStyle: 'italic', color: fg, lineHeight: 1 }}>
        Luna&nbsp;<span style={{ fontStyle: 'normal', fontFamily: 'inherit' }}>Travel</span>
      </span>
    </span>
  );
}

function Moon({ size, colour }: { size: number; colour: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8Z"
        fill={colour}
        opacity={0.95}
      />
      <circle cx="17" cy="7" r="1" fill={colour} />
      <circle cx="20" cy="10.5" r="0.6" fill={colour} />
    </svg>
  );
}

// ── Session context ──────────────────────────────────────────────────────────
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
const NAV: { key: NavKey; label: string; href: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Overview', href: '/agency', icon: LayoutGrid },
  { key: 'branding', label: 'App branding', href: '/agency/branding', icon: Palette },
  { key: 'access', label: 'Send access', href: '/agency/access', icon: Send },
];

export function AgencyShell({ active, children }: { active: NavKey; children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'out' | 'in'>('loading');
  const [me, setMe] = useState<AgencyMe | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/me', { cache: 'no-store' });
      if (!res.ok) return setState('out');
      setMe((await res.json()) as AgencyMe);
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
    setState('out');
    router.replace('/agency');
  };

  if (state === 'loading') {
    return (
      <Sky>
        <Wordmark on="dark" size={26} />
        <div style={{ marginTop: 22 }}>
          <Spinner />
        </div>
      </Sky>
    );
  }

  if (state === 'out' || !me) {
    return (
      <Sky>
        <div style={{ ...card, padding: 30, maxWidth: 400, width: '100%', textAlign: 'center' }} className="animate-slide-up">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <Wordmark on="light" size={22} />
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 24, color: P.ink }}>Agency portal</div>
          <p style={{ color: P.ink2, fontSize: 14, marginTop: 10, lineHeight: 1.55 }}>
            You&rsquo;re signed out. Access uses a one-time link — ask your Luna Travel contact to
            send you a fresh sign-in link.
          </p>
        </div>
      </Sky>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: P.bg }}>
      {/* Hero header — night sky */}
      <header style={{ background: HERO_BG, padding: '18px 20px 20px', color: '#fff' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Wordmark on="dark" size={19} />
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'right', minWidth: 0, marginRight: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
              {me.agency.name}
            </div>
            <div style={{ fontSize: 11, color: P.tealLight }}>Agency portal</div>
          </div>
          <button
            type="button"
            onClick={signOut}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 10, cursor: 'pointer' }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: `1px solid ${P.line}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 12px', display: 'flex', gap: 2, overflowX: 'auto' }}>
          {NAV.map((n) => {
            const on = active === n.key;
            const Icon = n.icon;
            return (
              <Link
                key={n.key}
                href={n.href}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '14px 14px', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
                  color: on ? P.navy : P.ink3,
                  borderBottom: `2.5px solid ${on ? P.teal : 'transparent'}`,
                  textDecoration: 'none',
                }}
              >
                <Icon size={16} strokeWidth={2} /> {n.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 72px' }} className="animate-fade-in">
        <AgencyContext.Provider value={{ me, refresh: load }}>{children}</AgencyContext.Provider>
      </main>
    </div>
  );
}

function Sky({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: HERO_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-label="Loading"
      className="animate-spin"
      style={{
        width: 26, height: 26, borderRadius: 999,
        border: `2.5px solid rgba(255,255,255,0.25)`, borderTopColor: P.tealLight,
        display: 'inline-block',
      }}
    />
  );
}
