'use client';

/**
 * The staff-facing half of "acting as an agency".
 *
 * Two pieces, both deliberately loud:
 *   ActAsBanner — an amber strip across every portal page while acting, naming
 *     the agency and offering one click out. The platform spec is explicit that
 *     impersonation must never be a quiet state; the incident that produced the
 *     spec was somebody not realising which account they were in.
 *   ActAsPicker — the way in. It renders only for Travelgenix staff, because
 *     the client list it needs is staff-gated at Control: a non-staff agent
 *     gets nothing back and sees nothing.
 */

import { useEffect, useState } from 'react';
import { Users, X, Search, ShieldAlert } from 'lucide-react';
import {
  fetchStaffClients, startActingAs, clearGrant, readGrant,
  type StaffClient,
} from '@/lib/act-as-client';
import { P } from './portal-chrome';

const AMBER = '#b45309';
const AMBER_BG = '#fffbeb';
const AMBER_LINE = '#fcd34d';

export function ActAsBanner({ agencyName, staffEmail }: { agencyName: string; staffEmail: string }) {
  const exit = () => {
    clearGrant();
    window.location.reload();
  };

  return (
    <div
      role="status"
      style={{
        background: AMBER_BG,
        borderBottom: `1px solid ${AMBER_LINE}`,
        color: AMBER,
      }}
    >
      <div
        style={{
          maxWidth: 760, margin: '0 auto', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}
      >
        <ShieldAlert size={16} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>
          You are acting as {agencyName}
        </span>
        <span style={{ fontSize: 12.5, opacity: 0.85, minWidth: 0 }}>
          Signed in as {staffEmail}. Anything you do here is recorded against you.
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={exit}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            border: `1px solid ${AMBER_LINE}`, background: '#fff', color: AMBER,
            fontSize: 12.5, fontWeight: 700, padding: '6px 11px',
            borderRadius: 9, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <X size={13} /> Stop
        </button>
      </div>
    </div>
  );
}

/**
 * Renders nothing at all unless Control confirms the viewer is staff, so an
 * agent never sees a control they cannot use.
 */
export function ActAsPicker() {
  const [clients, setClients] = useState<StaffClient[] | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState('');

  useEffect(() => {
    // Already acting: the banner is the control, not this.
    if (readGrant()) return;
    let cancelled = false;
    void fetchStaffClients().then((list) => {
      if (!cancelled && list?.length) setClients(list);
    });
    return () => { cancelled = true; };
  }, []);

  if (!clients) return null;

  const shown = q.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60)
    : clients.slice(0, 60);

  const pick = async (c: StaffClient) => {
    setBusy(c.id);
    setFailed('');
    const g = await startActingAs(c);
    if (!g) {
      setBusy('');
      setFailed('Could not start. You may not have staff access, or the session has expired.');
      return;
    }
    window.location.reload();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)',
          color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 12px',
          borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <Users size={14} /> Act as agency
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose an agency to act as"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(13,24,54,0.55)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16,
              boxShadow: '0 20px 50px rgba(13,24,54,0.3)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', maxHeight: '76vh',
            }}
          >
            <div style={{ padding: '16px 18px 12px', borderBottom: `1px solid ${P.line}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: P.ink }}>Act as an agency</h2>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  style={{ border: 'none', background: 'transparent', color: P.ink3, cursor: 'pointer', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12.5, color: P.ink2, lineHeight: 1.5 }}>
                You will see the portal exactly as they do, and their Travelify bookings become
                reachable. This tab only — other tabs stay as you.
              </p>
              <div style={{ position: 'relative', marginTop: 12 }}>
                <Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: P.ink3 }} />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search agencies"
                  style={{
                    width: '100%', border: `1px solid ${P.line}`, borderRadius: 10,
                    padding: '9px 12px 9px 32px', fontSize: 14, color: P.ink,
                    boxSizing: 'border-box', outlineColor: P.teal,
                  }}
                />
              </div>
            </div>

            <div style={{ overflowY: 'auto', padding: 8 }}>
              {shown.length === 0 && (
                <p style={{ padding: 16, margin: 0, fontSize: 13, color: P.ink3 }}>No agency matches that.</p>
              )}
              {shown.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={!!busy}
                  onClick={() => pick(c)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    border: 'none', background: busy === c.id ? P.bg : 'transparent',
                    padding: '11px 12px', borderRadius: 10, fontSize: 14,
                    color: P.ink, cursor: busy ? 'default' : 'pointer',
                  }}
                >
                  {c.name}
                  {busy === c.id && <span style={{ color: P.ink3, fontSize: 12 }}> · starting…</span>}
                </button>
              ))}
            </div>

            {failed && (
              <p style={{ margin: 0, padding: '10px 18px 14px', fontSize: 12.5, color: '#dc2626' }}>{failed}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
