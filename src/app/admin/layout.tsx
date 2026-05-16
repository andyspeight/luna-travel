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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('tg-admin-theme') as 'light' | 'dark' | null;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = stored ?? (systemDark ? 'dark' : 'light');
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tg-admin-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div className="flex flex-col min-h-screen bg-tg-bg-secondary">
      <header className="h-14 flex items-center px-4 gap-3 sticky top-0 z-10 bg-tg-bg border-b border-tg-border">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-tg-primary flex items-center justify-center">
            <Plane className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-tg-text">Luna Travel</div>
            <div className="text-xs text-tg-text-tertiary">Control panel</div>
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggle}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-tg-text-secondary hover:bg-tg-bg-secondary"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="h-7 w-7 rounded-lg bg-tg-primary text-white flex items-center justify-center text-xs font-semibold">
              AS
            </div>
            <div className="leading-tight hidden md:block">
              <div className="text-sm font-medium text-tg-text">Andy Speight</div>
              <div className="text-xs text-tg-text-tertiary">Travelgenix admin</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-60 shrink-0 flex flex-col bg-tg-bg border-r border-tg-border">
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV.map((item) => {
              const active = pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 h-10 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-tg-bg-tertiary text-tg-text font-medium'
                      : 'text-tg-text-secondary hover:bg-tg-bg-secondary hover:text-tg-text'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
