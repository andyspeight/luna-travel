'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Clock, ChevronRight, ArrowUpRight, UserPlus, Send,
  FileUp, FileX, LogIn, Image as ImageIcon, Inbox, RefreshCw,
} from 'lucide-react';

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgTertiary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textAccent: '#0096B7',
  primary: '#1B2B5B',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

// ───────────────────────── Types (mirror /api/admin/stats) ─────────────────────────
interface Stats {
  configured: boolean;
  reason?: string;
  generatedAt?: string;
  totals?: {
    agencies: number;
    travellers: number;
    travellersNew30d: number;
    trips: { upcoming: number; current: number; completed: number };
    invites: { total: number; redeemed: number; pending: number; expired: number };
    activationRate: number | null;
    documents: number;
    installs: number | null;
    installRate: number | null;
    active30d: number | null;
    active7d: number | null;
    telemetryReady?: boolean;
  };
  agencies?: Array<{
    id: string; name: string | null; tier: string | null; status: string | null;
    travellers: number; upcoming: number; invitesTotal: number; redeemed: number;
    activationRate: number | null; active30d: number | null; installs: number | null;
    lastActivityAt: string | null;
  }>;
  attention?: Array<{ agencyId: string; name: string | null; kind: string; detail: string }>;
  recent?: Array<{ id: string; type: string; text: string; context: string | null; at: string }>;
  warnings?: string[];
}

// ───────────────────────── Helpers ─────────────────────────
function relTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
const pct = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString());

function StatusDot({ status }: { status: string }) {
  const colour = status === 'live' ? C.success : status === 'paused' ? C.textTertiary : status === 'setup' ? C.info : C.warning;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8 }}>
      {status === 'live' && (
        <span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', opacity: 0.6, backgroundColor: colour, animation: 'tg-ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
      )}
      <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8, borderRadius: '50%', backgroundColor: colour }} />
    </span>
  );
}
function Pill({ tier }: { tier: string }) {
  const style = tier === 'Ignite' ? { bg: C.warningSoft, fg: C.warning } : tier === 'Boost' ? { bg: C.infoSoft, fg: C.info } : { bg: C.bgTertiary, fg: C.textSecondary };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', backgroundColor: style.bg, color: style.fg }}>{tier}</span>
  );
}
function Avatar({ name }: { name: string }) {
  const initials = name.split(/[\s_-]+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{ height: 36, width: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, flexShrink: 0, backgroundColor: C.primary }}>{initials || '—'}</div>
  );
}

const ACTIVITY_ICON: Record<string, { Icon: React.ElementType; fg: string; bg: string }> = {
  'invite.redeemed': { Icon: UserPlus, fg: C.success, bg: C.successSoft },
  'invite.created': { Icon: Send, fg: C.info, bg: C.infoSoft },
  'document.uploaded': { Icon: FileUp, fg: C.info, bg: C.infoSoft },
  'document.deleted': { Icon: FileX, fg: C.textSecondary, bg: C.bgTertiary },
  'admin.signin': { Icon: LogIn, fg: C.textSecondary, bg: C.bgTertiary },
  'admin.signin_failed': { Icon: AlertTriangle, fg: C.warning, bg: C.warningSoft },
  'hero.uploaded': { Icon: ImageIcon, fg: C.info, bg: C.infoSoft },
  'hero.removed': { Icon: ImageIcon, fg: C.textSecondary, bg: C.bgTertiary },
};

// ───────────────────────── Page ─────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setStats(null);
    fetch('/api/admin/stats', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 401 ? 'Your session has expired — please sign in again.' : 'Could not load analytics.'))))
      .then((d: Stats) => setStats(d))
      .catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const card: React.CSSProperties = { borderRadius: 12, backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, overflow: 'hidden' };

  return (
    <>
      <style>{`
        @keyframes tg-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes tg-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .tg-row:hover { background-color: ${C.bg} !important; }
        .tg-skel { background: ${C.bgTertiary}; border-radius: 6px; animation: tg-pulse 1.4s ease-in-out infinite; }
      `}</style>
      <div style={{ padding: '32px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Travelgenix admin</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Overview</h1>
          </div>
          <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: C.textSecondary, background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>
            <RefreshCw style={{ height: 14, width: 14 }} strokeWidth={1.75} /> Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{ ...card, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12, borderColor: C.warning, background: C.warningSoft }}>
            <AlertTriangle style={{ height: 18, width: 18, color: C.warning }} strokeWidth={1.75} />
            <span style={{ fontSize: 14, color: C.text }}>{error}</span>
            <button onClick={load} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, color: C.textAccent, background: 'none', border: 'none', cursor: 'pointer' }}>Try again</button>
          </div>
        )}

        {/* Not configured */}
        {stats && stats.configured === false && (
          <div style={{ ...card, padding: '28px 24px' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>Analytics not available</h2>
            <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>The database connection isn’t configured in this environment, so live metrics can’t be shown here.</p>
          </div>
        )}

        {/* Loading skeleton */}
        {!stats && !error && (
          <div>
            <div style={{ ...card, marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ padding: '20px 24px', borderLeft: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                  <div className="tg-skel" style={{ height: 10, width: 80, marginBottom: 12 }} />
                  <div className="tg-skel" style={{ height: 26, width: 56, marginBottom: 8 }} />
                  <div className="tg-skel" style={{ height: 10, width: 100 }} />
                </div>
              ))}
            </div>
            <div className="tg-skel" style={{ height: 220, borderRadius: 12 }} />
          </div>
        )}

        {/* Loaded */}
        {stats && stats.configured !== false && stats.totals && (() => {
          const t = stats.totals!;
          const empty = t.travellers === 0 && t.invites.total === 0;
          const agencies = stats.agencies || [];
          const recent = stats.recent || [];
          const attention = stats.attention || [];

          if (empty) {
            return (
              <div style={{ ...card, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ height: 48, width: 48, borderRadius: 12, background: C.bgTertiary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Inbox style={{ height: 22, width: 22, color: C.textTertiary }} strokeWidth={1.5} />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: '0 0 6px' }}>No traveller activity yet</h2>
                <p style={{ fontSize: 14, color: C.textSecondary, margin: '0 auto', maxWidth: 420 }}>
                  Once agencies start inviting travellers and those invites are redeemed, engagement metrics will appear here automatically.
                </p>
                <Link href="/admin/agencies" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 18, fontSize: 14, fontWeight: 500, color: C.textAccent, textDecoration: 'none' }}>
                  Manage agencies <ArrowUpRight style={{ height: 14, width: 14 }} strokeWidth={1.75} />
                </Link>
              </div>
            );
          }

          return (
            <>
              {/* KPI strip */}
              <div style={{ ...card, marginBottom: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {[
                    { label: 'Travellers', value: t.travellers.toLocaleString(), sub: `${t.travellersNew30d.toLocaleString()} new in 30d` },
                    { label: 'Installed', value: num(t.installs), sub: t.telemetryReady ? `${pct(t.installRate)} install rate` : 'telemetry pending' },
                    { label: 'Active in 30d', value: num(t.active30d), sub: t.telemetryReady ? `${num(t.active7d)} in last 7d` : 'telemetry pending' },
                    { label: 'Upcoming trips', value: t.trips.upcoming.toLocaleString(), sub: `${t.trips.current.toLocaleString()} travelling now` },
                  ].map((m, i) => (
                    <div key={i} style={{ padding: '20px 24px', borderLeft: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>{m.label}</div>
                      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{m.value}</div>
                      <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>{m.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent activity + Activation funnel */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
                <div style={card}>
                  <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Recent activity</h2>
                      <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>Live from the audit trail</div>
                    </div>
                    <Link href="/admin/audit" style={{ fontSize: 13, color: C.textTertiary, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>Full log <ChevronRight style={{ height: 14, width: 14 }} strokeWidth={1.75} /></Link>
                  </div>
                  <div>
                    {recent.length === 0 && (
                      <div style={{ padding: '24px', fontSize: 14, color: C.textTertiary }}>No recorded activity yet.</div>
                    )}
                    {recent.map((e, i) => {
                      const cfg = ACTIVITY_ICON[e.type] || { Icon: Clock, fg: C.textSecondary, bg: C.bgTertiary };
                      return (
                        <div key={e.id} className="tg-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                          <div style={{ height: 32, width: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: cfg.bg }}>
                            <cfg.Icon style={{ height: 15, width: 15, color: cfg.fg }} strokeWidth={1.75} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{e.text}</div>
                            {e.context && <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.context}</div>}
                          </div>
                          <div style={{ fontSize: 12, color: C.textTertiary, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{relTime(e.at)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={card}>
                  <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Activation</h2>
                    <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>Invites → onboarded</div>
                  </div>
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {([
                      { label: 'Redeemed', value: t.invites.redeemed, colour: C.success },
                      { label: 'Pending', value: t.invites.pending, colour: C.info },
                      { label: 'Expired', value: t.invites.expired, colour: C.warning },
                    ] as const).map((row) => {
                      const total = Math.max(t.invites.total, 1);
                      return (
                        <div key={row.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, color: C.textTertiary }}>{row.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{row.value.toLocaleString()}</span>
                          </div>
                          <div style={{ height: 8, borderRadius: 4, backgroundColor: C.bgTertiary, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(row.value / total) * 100}%`, backgroundColor: row.colour, transition: 'width .4s ease' }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, color: C.textTertiary }}>Activation rate</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>{pct(t.activationRate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Needs attention (only when there is something real) */}
              {attention.length > 0 && (
                <div style={{ ...card, marginBottom: 24 }}>
                  <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Needs attention</h2>
                    <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>Derived from live activation data</div>
                  </div>
                  <div>
                    {attention.map((row, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                        <div style={{ height: 32, width: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: C.warningSoft }}>
                          <AlertTriangle style={{ height: 15, width: 15, color: C.warning }} strokeWidth={1.75} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{row.name || row.agencyId || 'Across all agencies'}</div>
                          <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 1 }}>{row.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agencies rollup */}
              <div style={card}>
                <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Agencies by engagement</h2>
                    <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{agencies.length} with activity</div>
                  </div>
                  <Link href="/admin/agencies" style={{ fontSize: 13, color: C.textTertiary, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>Manage <ChevronRight style={{ height: 14, width: 14 }} strokeWidth={1.75} /></Link>
                </div>
                <div>
                  {agencies.length === 0 && <div style={{ padding: '24px', fontSize: 14, color: C.textTertiary }}>No agencies with activity yet.</div>}
                  {agencies.slice(0, 8).map((a, i) => (
                    <div key={a.id} className="tg-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                      <Avatar name={a.name || a.id} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 500, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {a.name || a.id}
                          {a.status && <StatusDot status={a.status} />}
                        </div>
                        <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>Last activity {relTime(a.lastActivityAt)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 32, fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ textAlign: 'right', width: 80 }}>
                          <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{a.travellers.toLocaleString()}</div>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>travellers</div>
                        </div>
                        <div style={{ textAlign: 'right', width: 80 }}>
                          <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{num(a.active30d)}</div>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>active 30d</div>
                        </div>
                        <div style={{ textAlign: 'right', width: 88 }}>
                          <div style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{pct(a.activationRate)}</div>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textTertiary, marginTop: 2 }}>activation</div>
                        </div>
                      </div>
                      {a.tier && <Pill tier={a.tier} />}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 16, fontSize: 12, color: C.textTertiary, textAlign: 'right' }}>
                Live data · refreshed {relTime(stats.generatedAt || null)}
              </div>
            </>
          );
        })()}
      </div>
    </>
  );
}
