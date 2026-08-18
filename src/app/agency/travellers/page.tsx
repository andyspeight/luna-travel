'use client';

/**
 * /agency/travellers — the signed-in agency's own travellers, with engagement
 * at a glance (installed / opened, opens, last seen) and a shortcut to message
 * each one. Read-only; all scoped to the session's agency.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, MessageSquare, MapPin } from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card } from '../portal-chrome';

interface Traveller {
  id: string;
  name: string;
  bookingRef: string | null;
  email: string | null;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  status: string | null;
  installStatus: string | null;
  opened: boolean;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  createdAt: string | null;
}

function TravellersPage() {
  const [travellers, setTravellers] = useState<Traveller[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/travellers', { cache: 'no-store' });
      if (res.ok) setTravellers((await res.json()).travellers ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const installed = travellers.filter((t) => t.opened).length;

  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Travellers</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
        Everyone you&rsquo;ve sent app access — who&rsquo;s opened their trip, and how to reach them.
      </p>

      {!loading && travellers.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <Stat label="Travellers" value={travellers.length} />
          <Stat label="Opened the app" value={installed} />
        </div>
      )}

      {loading ? (
        <p style={{ color: P.ink3, fontSize: 13, marginTop: 18 }}>Loading…</p>
      ) : travellers.length === 0 ? (
        <div style={{ marginTop: 18 }}>
          <Callout title="No travellers yet" icon={<Users size={16} />}>
            Once you send a traveller access (from <strong>Send access</strong>) and they open their
            trip, they&rsquo;ll appear here.
          </Callout>
        </div>
      ) : (
        <div style={{ ...card, marginTop: 18, overflow: 'hidden' }}>
          {travellers.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderTop: i === 0 ? 'none' : `1px solid ${P.line}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: P.ink }}>{t.name}</span>
                  <EngagementPill traveller={t} />
                </div>
                <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {t.destination && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} /> {t.destination}
                    </span>
                  )}
                  {t.bookingRef && <span style={{ fontFamily: 'ui-monospace, monospace' }}>· {t.bookingRef}</span>}
                  {t.departureDate && <span>· departs {fmtDate(t.departureDate)}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: P.ink3, marginTop: 2 }}>
                  {t.opened
                    ? `${t.openCount} open${t.openCount === 1 ? '' : 's'}${t.lastOpenedAt ? ` · last ${fmtDate(t.lastOpenedAt)}` : ''}`
                    : 'Not opened yet'}
                </div>
              </div>
              <Link
                href={`/agency/messages?travellerId=${encodeURIComponent(t.id)}`}
                title="Message this traveller"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${P.line}`, background: '#fff', color: P.navy, fontSize: 13, fontWeight: 600, padding: '8px 12px', borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                <MessageSquare size={14} /> Message
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ ...card, padding: '12px 16px', minWidth: 130 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: P.navy, fontFamily: SERIF }}>{value}</div>
      <div style={{ fontSize: 12, color: P.ink3, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function EngagementPill({ traveller }: { traveller: Traveller }) {
  const opened = traveller.opened;
  const s = opened
    ? { label: 'Opened', fg: '#047857', bg: '#d1fae5' }
    : { label: 'Not opened', fg: '#b45309', bg: '#fef3c7' };
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: s.fg, background: s.bg, borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function AgencyTravellersPage() {
  return (
    <AgencyShell active="travellers">
      <TravellersPage />
    </AgencyShell>
  );
}
