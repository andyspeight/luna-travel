'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Users,
  RefreshCw,
  Shield,
  Settings,
  Plane,
  Sun,
  Moon,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Overview',     href: '/admin/dashboard',  icon: LayoutDashboard },
  { id: 'agencies',   label: 'Agencies',     href: '/admin/agencies',   icon: Building2 },
  { id: 'travellers', label: 'Travellers',   href: '/admin/travellers', icon: Users },
  { id: 'sync',       label: 'Sync monitor', href: '/admin/sync',       icon: RefreshCw },
  { id: 'audit',      label: 'Audit log',    href: '/admin/audit',      icon: Shield },
  { id: 'settings',   label: 'Settings',     href: '/admin/settings',   icon: Settings },
];

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Hydrate theme from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem('tg-admin-theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored ?? (systemPrefersDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tg-admin-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--tg-bg-secondary)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: 'var(--tg-text-primary)',
      }}
    >
      {/* Top bar */}
      <header
        className="h-14 flex items-center px-4 gap-3 sticky top-0"
        style={{
          backgroundColor: 'var(--tg-bg-primary)',
          borderBottom: '1px solid var(--tg-border)',
          zIndex: 10,
        }}
      >
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:shadow-[var(--tg-shadow-focus)]">
          <div
            className="h-8 w-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: 'var(--tg-primary)' }}
          >
            <Plane className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tg-text-primary)' }}>
              Luna Travel
            </div>
            <div style={{ fontSize: 11, color: 'var(--tg-text-tertiary)' }}>
              Control panel
            </div>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="h-9 w-9 rounded-md flex items-center justify-center transition-colors focus-visible:outline-none"
            style={{ color: 'var(--tg-text-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--tg-bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onFocus={(e) => (e.currentTarget.style.boxShadow = 'var(--tg-shadow-focus)')}
            onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>

          <div className="flex items-center gap-2 px-2 py-1 rounded-md">
            <div
              className="h-7 w-7 rounded-md flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: 'var(--tg-primary)', fontSize: 11 }}
            >
              AS
            </div>
            <div className="leading-tight hidden md:block">
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tg-text-primary)' }}>
                Andy Speight
              </div>
              <div style={{ fontSize: 11, color: 'var(--tg-text-tertiary)' }}>
                Travelgenix admin
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className="w-60 shrink-0 flex flex-col"
          style={{
            backgroundColor: 'var(--tg-bg-primary)',
            borderRight: '1px solid var(--tg-border)',
          }}
        >
          <nav className="flex-1 px-3 py-4 space-y-1" role="navigation" aria-label="Admin navigation">
            {NAV_ITEMS.map((item) => {
              const active = pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cx(
                    'flex items-center gap-3 px-3 h-10 rounded-md transition-colors focus-visible:outline-none'
                  )}
                  style={{
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                    color: active ? 'var(--tg-text-primary)' : 'var(--tg-text-secondary)',
                    backgroundColor: active ? 'var(--tg-bg-tertiary)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = 'var(--tg-bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = 'var(--tg-shadow-focus)')}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto" style={{ minHeight: 'calc(100dvh - 56px)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
