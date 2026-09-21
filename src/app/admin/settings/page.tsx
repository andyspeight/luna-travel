'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, CheckCircle2, XCircle, Power, Plane, Wrench, Clock, Users, CreditCard, ExternalLink, RefreshCw, HardDrive,
} from 'lucide-react';
import { humanBytes } from '@/lib/storage-cleanup';

const C = {
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
  danger: '#EF4444',
  warning: '#F59E0B',
};

interface Settings {
  onboardingPaused: boolean;
  flightAlertsPaused: boolean;
  maintenance: { enabled: boolean; message: string };
  inviteExpiryDays: number;
}
interface Status {
  supabase: boolean;
  aerodatabox: { reachable: boolean; status: number | null };
  control: boolean;
  cron: boolean;
  env: Record<string, boolean>;
  envSet: number;
  envTotal: number;
}

interface PurgeItem { path: string; reason: 'soft-deleted' | 'orphaned'; sizeBytes: number }
interface CleanupResult {
  ok: boolean;
  dryRun: boolean;
  summary: string;
  graceDays: number;
  scanned: number;
  documents: number;
  purge: PurgeItem[];
  kept: number;
  bytes: number;
  capped: boolean;
  notes: string[];
  error?: string;
  detail?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [maintMsg, setMaintMsg] = useState('');
  const [expiry, setExpiry] = useState('30');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setSettings(d.settings);
        setStatus(d.status);
        setMaintMsg(d.settings.maintenance.message || '');
        setExpiry(String(d.settings.inviteExpiryDays));
      }
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (key: string, value: unknown) => {
    setSavingKey(key);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) setSettings((await res.json()).settings);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Travelgenix admin</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>Settings</h1>
      </div>

      {loading && !settings ? (
        <div style={{ color: C.textSecondary, fontSize: 14 }}>Loading…</div>
      ) : !settings || !status ? (
        <div style={{ color: C.danger, fontSize: 14 }}>Couldn&rsquo;t load settings.</div>
      ) : (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Platform status */}
          <Card title="Platform status" icon={<Activity size={16} />} action={
            <button onClick={load} style={ghost}><RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh</button>
          }>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <StatusTile ok={status.supabase} label="Supabase" detail={status.supabase ? 'Connected' : 'Unreachable'} />
              <StatusTile ok={status.aerodatabox.reachable} label="AeroDataBox" detail={status.aerodatabox.reachable ? 'Reachable' : `No response${status.aerodatabox.status ? ` (${status.aerodatabox.status})` : ''}`} />
              <StatusTile ok={status.control} label="Control (Travelgenix ID)" detail={status.control ? 'Reachable' : 'Unreachable'} />
              <StatusTile ok={status.cron} label="Cron" detail={status.cron ? 'Configured' : 'CRON_SECRET unset'} />
            </div>
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary }}>
                <span style={{ fontWeight: 600, color: C.text }}>Environment</span>
                <span>{status.envSet}/{status.envTotal} set</span>
              </div>
              {status.envSet < status.envTotal && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(status.env).filter(([, v]) => !v).map(([k]) => (
                    <span key={k} style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.danger, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '2px 7px' }}>{k}</span>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Kill switches */}
          <Card title="Kill switches" icon={<Power size={16} />} subtitle="Take effect immediately across the platform.">
            <SwitchRow
              icon={<Users size={15} />}
              label="Pause new traveller onboarding"
              hint="Blocks redeeming a new invite. Existing travellers are unaffected."
              on={settings.onboardingPaused}
              busy={savingKey === 'onboarding_paused'}
              onChange={(v) => save('onboarding_paused', v)}
            />
            <SwitchRow
              icon={<Plane size={15} />}
              label="Pause flight-alert subscriptions"
              hint="Stops registering NEW flight subscriptions (e.g. to preserve API units). Already-watched flights keep updating."
              on={settings.flightAlertsPaused}
              busy={savingKey === 'flight_alerts_paused'}
              onChange={(v) => save('flight_alerts_paused', v)}
            />
            <div style={{ padding: '14px 0', borderTop: `1px solid ${C.border}` }}>
              <SwitchRow
                icon={<Wrench size={15} />}
                label="Maintenance banner"
                hint="Shows an app-wide banner to travellers."
                on={settings.maintenance.enabled}
                busy={savingKey === 'maintenance'}
                onChange={(v) => save('maintenance', { enabled: v, message: maintMsg })}
                noBorder
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  value={maintMsg}
                  onChange={(e) => setMaintMsg(e.target.value)}
                  maxLength={280}
                  placeholder="Optional message (defaults to a generic maintenance notice)"
                  style={input}
                />
                <button onClick={() => save('maintenance', { enabled: settings.maintenance.enabled, message: maintMsg })} style={primaryBtn}>Save message</button>
              </div>
            </div>
          </Card>

          {/* System defaults */}
          <Card title="System defaults" icon={<Clock size={16} />}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Default invite expiry (days)</div>
                <input type="number" min={1} max={365} value={expiry} onChange={(e) => setExpiry(e.target.value)} style={{ ...input, width: 120 }} />
              </label>
              <button
                onClick={() => save('invite_expiry_days', Number(expiry))}
                disabled={savingKey === 'invite_expiry_days'}
                style={primaryBtn}
              >
                {savingKey === 'invite_expiry_days' ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 8 }}>
              Applied to new invites (admin and agency portal) when no explicit expiry is given.
            </div>
          </Card>

          <StorageCard />

          {/* Team & billing — honest pointers */}
          <Card title="Team & billing" icon={<Users size={16} />}>
            <Pointer icon={<Users size={15} />} label="Admin access" body="Admins are granted the luna_travel permission in Control (Travelgenix ID) — that's the single source of truth. Manage the team there.">
              <a href="https://id.travelify.io" target="_blank" rel="noreferrer" style={link}>Open Control <ExternalLink size={12} /></a>
            </Pointer>
            <Pointer icon={<CreditCard size={15} />} label="Billing" body="Luna Travel has no separate billing. Integration usage (e.g. AeroDataBox / API.Market flight-alert units) is billed on those provider accounts." />
          </Card>
        </div>
      )}

      <style>{`.spin{animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/**
 * Stored documents — the retention job, without a terminal.
 *
 * Removing a document is a soft delete; the file itself goes when the weekly
 * job runs. This is the same job, on a button, so nobody has to hold a secret
 * and a curl command to see what is about to happen.
 *
 * Preview is a GET and removing is a POST, so a refresh, a prefetch or a pasted
 * URL cannot destroy anything. The removal button arms on the first click and
 * only acts on the second.
 */
function StorageCard() {
  const [result, setResult] = useState<CleanupResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [armed, setArmed] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async (apply: boolean) => {
    setBusy(apply ? 'apply' : 'preview');
    setFailed(false);
    if (!apply) setResult(null);
    try {
      const res = await fetch('/api/admin/storage-cleanup', {
        method: apply ? 'POST' : 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      setResult((await res.json()) as CleanupResult);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
      setArmed(false);
    }
  };

  const removable = result?.ok && !!result.dryRun && result.purge.length > 0;
  const done = result?.ok && result.dryRun === false;

  return (
    <Card
      title="Stored documents"
      icon={<HardDrive size={16} />}
      subtitle="Removing a document hides it immediately. The file itself goes on a 30-day delay, or here."
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => run(false)} disabled={busy !== null} style={primaryBtn}>
          {busy === 'preview' ? 'Checking…' : 'Preview what would be removed'}
        </button>
        <span style={{ fontSize: 12, color: C.textTertiary }}>
          Reads only. Nothing is removed until you say so.
        </span>
      </div>

      {failed && (
        <div style={{ marginTop: 14, fontSize: 13, color: C.danger }}>
          Couldn&rsquo;t reach the server. Try again.
        </div>
      )}

      {result && !result.ok && (
        <div style={{ marginTop: 14, ...panel('#FEF2F2', '#FECACA') }}>
          <div style={{ fontWeight: 600, color: '#B91C1C', fontSize: 13 }}>
            It refused to run — and that is the safe outcome.
          </div>
          <div style={{ fontSize: 13, color: '#7F1D1D', marginTop: 4 }}>
            {result.detail || result.error}
          </div>
          <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 6 }}>
            It will not plan a removal from an incomplete picture. Nothing was touched.
          </div>
        </div>
      )}

      {result?.ok && (
        <>
          <div
            style={{
              marginTop: 14,
              ...panel(done ? '#F0FDF4' : '#F8FAFC', done ? '#BBF7D0' : C.border),
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: done ? '#15803D' : C.text }}>
              {result.summary}
            </div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 6 }}>
              Scanned {result.scanned} file{result.scanned === 1 ? '' : 's'} in the bucket
              against {result.documents} document record{result.documents === 1 ? '' : 's'}.
              Grace period {result.graceDays} days.
            </div>
            {result.notes.map((n, i) => (
              <div key={i} style={{ fontSize: 12, color: C.warning, marginTop: 6, fontWeight: 600 }}>
                {n}
              </div>
            ))}
          </div>

          {result.purge.length > 0 && (
            <div style={{ marginTop: 12, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
              {result.purge.slice(0, 50).map((p) => (
                <div
                  key={p.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderTop: `1px solid ${C.border}`,
                    fontSize: 12,
                  }}
                >
                  <span style={{ flex: 1, fontFamily: 'ui-monospace, monospace', color: C.text, wordBreak: 'break-all' }}>
                    {p.path}
                  </span>
                  <span style={{ color: C.textSecondary, whiteSpace: 'nowrap' }}>
                    {p.reason === 'orphaned' ? 'no record' : 'past grace period'}
                  </span>
                  <span style={{ color: C.textTertiary, whiteSpace: 'nowrap' }}>{humanBytes(p.sizeBytes)}</span>
                </div>
              ))}
              {result.purge.length > 50 && (
                <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textTertiary }}>
                  …and {result.purge.length - 50} more.
                </div>
              )}
            </div>
          )}

          {removable && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => (armed ? run(true) : setArmed(true))}
                disabled={busy !== null}
                style={{ ...primaryBtn, background: armed ? C.danger : '#fff', color: armed ? '#fff' : C.danger, border: `1px solid ${C.danger}` }}
              >
                {busy === 'apply'
                  ? 'Removing…'
                  : armed
                    ? `Yes — remove ${result.purge.length} file${result.purge.length === 1 ? '' : 's'} permanently`
                    : `Remove ${result.purge.length} file${result.purge.length === 1 ? '' : 's'}`}
              </button>
              {armed && (
                <button onClick={() => setArmed(false)} style={ghost}>Cancel</button>
              )}
              <span style={{ fontSize: 12, color: C.textTertiary }}>
                {armed ? 'This cannot be undone.' : 'You will be asked to confirm.'}
              </span>
            </div>
          )}

          {result.dryRun && result.purge.length === 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: C.textTertiary }}>
              Nothing to do. The weekly job runs Sunday at 03:00 regardless, so this rarely needs pressing.
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function panel(bg: string, border: string): React.CSSProperties {
  return { background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: 12 };
}

function Card({ title, subtitle, icon, action, children }: { title: string; subtitle?: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ color: C.accent }}>{icon}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: C.textTertiary }}>{subtitle}</div>}
        </div>
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

function StatusTile({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: C.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {ok ? <CheckCircle2 size={15} color={C.success} /> : <XCircle size={15} color={C.danger} />}
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: ok ? C.textSecondary : C.danger, marginTop: 4 }}>{detail}</div>
    </div>
  );
}

function SwitchRow({ icon, label, hint, on, busy, onChange, noBorder }: { icon: React.ReactNode; label: string; hint: string; on: boolean; busy: boolean; onChange: (v: boolean) => void; noBorder?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: noBorder ? 0 : '14px 0', borderTop: noBorder ? 'none' : `1px solid ${C.border}` }}>
      <span style={{ color: on ? C.warning : C.textTertiary, marginTop: 2 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</div>
        <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2, lineHeight: 1.45 }}>{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={busy}
        onClick={() => onChange(!on)}
        style={{
          width: 44, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: on ? C.warning : C.border, position: 'relative', transition: 'background 0.15s', opacity: busy ? 0.6 : 1,
        }}
      >
        <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 19, height: 19, borderRadius: 999, background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </button>
    </div>
  );
}

function Pointer({ icon, label, body, children }: { icon: React.ReactNode; label: string; body: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0' }}>
      <span style={{ color: C.textTertiary, marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</div>
        <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2, lineHeight: 1.45 }}>{body}</div>
        {children && <div style={{ marginTop: 6 }}>{children}</div>}
      </div>
    </div>
  );
}

const input: React.CSSProperties = { flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 11px', fontSize: 13, color: C.text, background: '#fff', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { background: C.primary, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' };
const ghost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', color: C.textSecondary, fontSize: 13, fontWeight: 500, cursor: 'pointer' };
const link: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, color: C.accent, fontSize: 13, fontWeight: 600, textDecoration: 'none' };
