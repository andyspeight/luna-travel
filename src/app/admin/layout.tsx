'use client';

import React, { useState, useEffect, useRef } from 'react';

/** Marks that we have already bounced to sign-in this tab — see the effect. */
const RETURNED_KEY = 'lt-admin-signin-attempted';

type AuthState =
  | { state: 'ok' }
  | { state: 'signed-out' }
  | { state: 'no-permission'; email: string }
  | { state: 'unavailable' };
import { usePathname, useRouter } from 'next/navigation';
import { signInUrl } from '@/lib/admin-session';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, Users, RefreshCw,
  Shield, Settings, Plane, Sun, Moon, LogOut, ChevronDown,
  Image as ImageIcon, QrCode, FilePlus,
} from 'lucide-react';

// The Demo tab surfaces mock booking data and /?demo= deep-links — useful for
// walkthroughs, but not something every production admin should be led with.
// Hidden in production unless NEXT_PUBLIC_LUNA_DEMO=1 is set on the deployment.
// The /admin/demo route itself stays reachable by direct URL either way.
const SHOW_DEMO =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_LUNA_DEMO === '1';

// The Flight test / health rig is an internal diagnostic, not for agency-facing
// admins — surfaced in the nav only for the owner. (The /admin/flight-test route
// stays reachable by direct URL for anyone with admin access.)
const OWNER_EMAIL = 'andy.speight@agendas.group';

const NAV = [
  { id: 'demo', label: 'Demo', href: '/admin/demo', icon: QrCode },
  { id: 'dashboard', label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
  { id: 'agencies', label: 'Agencies', href: '/admin/agencies', icon: Building2 },
  { id: 'travellers', label: 'Travellers', href: '/admin/travellers', icon: Users },
  { id: 'add-booking', label: 'Add booking', href: '/admin/bookings/new', icon: FilePlus },
  { id: 'heroes', label: 'Hero images', href: '/admin/heroes', icon: ImageIcon },
  { id: 'sync', label: 'Sync monitor', href: '/admin/sync', icon: RefreshCw },
  { id: 'flight-test', label: 'Flight test', href: '/admin/flight-test', icon: Plane },
  { id: 'audit', label: 'Audit log', href: '/admin/audit', icon: Shield },
  { id: 'settings', label: 'Settings', href: '/admin/settings', icon: Settings },
];

const COLOURS = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgTertiary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  primary: '#1B2B5B',
  accent: '#00B4D8',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
};

const DARK = {
  bg: '#0F172A',
  bgElevated: '#1E293B',
  bgTertiary: '#334155',
  border: '#334155',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textTertiary: '#64748B',
  primary: '#1B2B5B',
  accent: '#00B4D8',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // A client layout cannot export metadata, and the site-wide default is now
  // the traveller's neutral "Your trip".
  useEffect(() => {
    document.title = 'Admin · Luna Travel';
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('tg-admin-theme') as 'light' | 'dark' | null;
    // Default to light. (Previously fell back to the OS dark preference, which
    // loaded the admin dark on dark-OS machines and left it inconsistent with
    // pages that default to light.)
    setTheme(stored === 'dark' ? 'dark' : 'light');

    // Resolve who is signed in, and what to do if nobody is.
    //
    // This used to swallow the failure, on the stated assumption that
    // "middleware should have already redirected to /admin/signin". It does
    // not: admin PAGES stopped being gated in the SSO migration on the
    // understanding that a client-side tg-auth-gate.js would take over, and
    // that script was never added to this app. So the shell rendered for
    // anyone, every API answered 401, and the only control on screen was a
    // Try again button that re-ran the same doomed request. Somebody hit that
    // dead end two weeks running before it was reported.
    void (async () => {
      try {
        const res = await fetch('/api/admin/me', { credentials: 'include' });
        if (res.ok) {
          const data = (await res.json()) as { email?: string };
          setAuth(data?.email ? { state: 'ok' } : { state: 'signed-out' });
          if (data?.email) setAdminEmail(data.email);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as {
          reason?: string;
          email?: string;
        };
        if (body.reason === 'no-permission') {
          setAuth({ state: 'no-permission', email: body.email || '' });
        } else if (body.reason === 'unavailable') {
          setAuth({ state: 'unavailable' });
        } else {
          setAuth({ state: 'signed-out' });
        }
      } catch {
        // Reaching our own API failed, which is not the same as being signed
        // out. Saying "sign in again" here would be a guess.
        setAuth({ state: 'unavailable' });
      }
    })();
  }, []);

  // Send a signed-out admin to Travelgenix ID, once.
  //
  // Once, deliberately. If Control sends them back still signed out, a second
  // automatic redirect is an infinite loop with no way to read the screen. The
  // mark survives the round trip, so the second landing offers a button
  // instead and the person stays in control of it.
  useEffect(() => {
    if (auth?.state !== 'signed-out') return;
    let alreadyTried = false;
    try {
      alreadyTried = sessionStorage.getItem(RETURNED_KEY) === '1';
      sessionStorage.setItem(RETURNED_KEY, '1');
    } catch {
      // Private window, or storage blocked. Offer the button rather than risk
      // bouncing somebody who cannot remember they have been here.
      alreadyTried = true;
    }
    if (!alreadyTried) window.location.href = signInUrl(window.location.href);
  }, [auth]);

  // A good sign-in clears the mark, so the next lapse redirects automatically
  // again rather than making them press a button forever.
  useEffect(() => {
    if (auth?.state !== 'ok') return;
    try {
      sessionStorage.removeItem(RETURNED_KEY);
    } catch {
      /* nothing to clear */
    }
  }, [auth]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const signOut = async () => {
    try {
      await fetch('/api/admin/signout', { method: 'POST', credentials: 'include' });
    } catch { /* swallow — proceed to redirect either way */ }
    router.push('/admin/signin');
  };

  const c = theme === 'dark' ? DARK : COLOURS;

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tg-admin-theme', next);
    // Notify other mounted admin pages (e.g. /admin/heroes) in THIS tab. The
    // native 'storage' event only fires in other tabs, so without this the
    // heroes page would not flip until a refresh.
    window.dispatchEvent(new Event('tg-admin-theme-change'));
  };

  // Derive initials from email for the avatar — first letter of local part,
  // first letter after first dot (if any). e.g. andy.speight@travelgenix.io → AS,
  // andy@travelgenix.io → A.
  const initials = (() => {
    if (!adminEmail) return '··';
    const local = adminEmail.split('@')[0] || '';
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.[0] || '·').toUpperCase();
  })();

  const displayName = adminEmail
    ? (adminEmail.split('@')[0] || adminEmail).replace(/[._-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    : '…';

  // Sign-in page renders without the admin chrome. The middleware lets
  // the sign-in route through without auth, so wrapping it in the same
  // sidebar/topbar would just confuse the user (showing a sidebar they
  // can't use, an avatar that says "loading", etc).
  if (pathname === '/admin/signin' || pathname === '/admin/signin/') {
    return <>{children}</>;
  }

  // Nothing decided yet. Showing the full shell here is what produced a
  // working-looking admin panel where every button failed.
  if (auth === null) {
    return <AuthScreen c={c} title="Checking your access…" body="One moment." />;
  }

  // Signed in, but not for this product. The message names the account and
  // what to ask for, because "your session has expired" sent somebody round
  // the sign-in loop twice a week to be told the same thing.
  if (auth.state === 'no-permission') {
    return (
      <AuthScreen
        c={c}
        title="You don’t have access to Luna Travel"
        body={`You are signed in${auth.email ? ` as ${auth.email}` : ''}, so signing in again will not change this. Ask an administrator to grant you the Luna Travel permission in Travelgenix ID, then reload this page.`}
        action={{ label: 'Open Travelgenix ID', href: 'https://id.travelify.io' }}
      />
    );
  }

  if (auth.state === 'unavailable') {
    return (
      <AuthScreen
        c={c}
        title="Can’t reach Travelgenix ID"
        body="Your sign-in could not be checked, which is a problem at our end rather than anything you have done. Try again in a moment."
        action={{ label: 'Try again', onClick: () => window.location.reload() }}
      />
    );
  }

  if (auth.state === 'signed-out') {
    return (
      <AuthScreen
        c={c}
        title="Please sign in"
        body="Your session has ended. Signing in again through Travelgenix ID will bring you straight back here."
        action={{ label: 'Sign in', onClick: () => { window.location.href = signInUrl(window.location.href); } }}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: c.bg,
      color: c.text,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* TOP BAR */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        backgroundColor: c.bgElevated,
        borderBottom: `1px solid ${c.border}`,
      }}>
        <Link href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            height: 32, width: 32, borderRadius: 8,
            backgroundColor: c.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plane style={{ height: 16, width: 16, color: '#fff' }} strokeWidth={2} />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>Luna Travel</div>
            <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 2 }}>Control panel</div>
          </div>
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            style={{
              height: 36, width: 36, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'transparent', border: 'none',
              color: c.textSecondary, cursor: 'pointer',
            }}
          >
            {mounted && (theme === 'dark' ? <Sun style={{ height: 16, width: 16 }} /> : <Moon style={{ height: 16, width: 16 }} />)}
          </button>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px 4px 4px',
                borderRadius: 8,
                backgroundColor: menuOpen ? c.bgTertiary : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.backgroundColor = c.bgTertiary; }}
              onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.backgroundColor = 'transparent'; }}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div style={{
                height: 28, width: 28, borderRadius: 8,
                backgroundColor: c.primary, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600,
              }}>{initials}</div>
              <div style={{ lineHeight: 1.2, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>{displayName}</div>
                <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 2 }}>Travelgenix admin</div>
              </div>
              <ChevronDown
                style={{ height: 14, width: 14, color: c.textTertiary, marginLeft: 2, transition: 'transform 150ms', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)' }}
                strokeWidth={2}
              />
            </button>

            {menuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  minWidth: 240,
                  backgroundColor: c.bgElevated,
                  border: `1px solid ${c.border}`,
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                  overflow: 'hidden',
                  zIndex: 20,
                }}
              >
                <div style={{
                  padding: '12px 14px',
                  borderBottom: `1px solid ${c.border}`,
                }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.textTertiary, marginBottom: 3 }}>
                    Signed in as
                  </div>
                  <div style={{ fontSize: 13, color: c.text, wordBreak: 'break-all' }}>
                    {adminEmail || 'Loading…'}
                  </div>
                </div>
                <button
                  onClick={signOut}
                  role="menuitem"
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    fontSize: 13, color: c.text, fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = c.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <LogOut style={{ height: 14, width: 14, color: c.textSecondary }} strokeWidth={1.75} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* SIDEBAR */}
        <aside style={{
          width: 240,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: c.bgElevated,
          borderRight: `1px solid ${c.border}`,
        }}>
          <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.filter((item) =>
              (item.id !== 'demo' || SHOW_DEMO) &&
              (item.id !== 'flight-test' || adminEmail === OWNER_EMAIL),
            ).map((item) => {
              const active = pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '0 12px',
                    height: 40,
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    color: active ? c.text : c.textSecondary,
                    backgroundColor: active ? c.bgTertiary : 'transparent',
                    transition: 'background-color 150ms, color 150ms',
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = c.bg; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Icon style={{ height: 16, width: 16, flexShrink: 0 }} strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * The screen somebody sees instead of an admin panel they cannot use.
 *
 * Deliberately replaces the shell rather than sitting inside it. A sidebar
 * full of links that all 401 reads as "the product is broken"; a single plain
 * screen reads as "here is where you are and here is what to do about it".
 */
function AuthScreen({
  c,
  title,
  body,
  action,
}: {
  c: { bg: string; bgElevated: string; border: string; text: string; textSecondary: string; accent: string };
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  const btn: React.CSSProperties = {
    display: 'inline-block',
    marginTop: 20,
    padding: '10px 18px',
    borderRadius: 8,
    background: c.accent,
    color: '#fff',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: c.bg,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: '100%',
          background: c.bgElevated,
          border: `1px solid ${c.border}`,
          borderRadius: 14,
          padding: 28,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: c.textSecondary }}>
          Luna Travel
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: c.text, margin: '10px 0 8px' }}>{title}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: c.textSecondary, margin: 0 }}>{body}</p>
        {action &&
          (action.href ? (
            <a href={action.href} style={btn}>
              {action.label}
            </a>
          ) : (
            <button onClick={action.onClick} style={btn}>
              {action.label}
            </button>
          ))}
      </div>
    </div>
  );
}
