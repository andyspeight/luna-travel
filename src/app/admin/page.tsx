'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, Users, RefreshCw,
  Shield, Settings, Plane, Sun, Moon,
} from 'lucide-react';

const NAV = [
  { id: 'dashboard', label: 'Overview', href: '/admin/dashboard', icon: LayoutDashboard },
  { id: 'agencies', label: 'Agencies', href: '/admin/agencies', icon: Building2 },
  { id: 'travellers', label: 'Travellers', href: '/admin/travellers', icon: Users },
  { id: 'sync', label: 'Sync monitor', href: '/admin/sync', icon: RefreshCw },
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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('tg-admin-theme') as 'light' | 'dark' | null;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored ?? (systemDark ? 'dark' : 'light');
    setTheme(initial);
  }, []);

  const c = theme === 'dark' ? DARK : COLOURS;

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tg-admin-theme', next);
  };

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
            <div style={{
              height: 28, width: 28, borderRadius: 8,
              backgroundColor: c.primary, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
            }}>AS</div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>Andy Speight</div>
              <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 2 }}>Travelgenix admin</div>
            </div>
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
            {NAV.map((item) => {
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
