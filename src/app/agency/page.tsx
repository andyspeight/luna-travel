'use client';

/**
 * /agency — the portal home. A "pulse" dashboard for the signed-in agency:
 * headline counts, anything needing attention (unread replies), the next
 * departures, and quick actions into the rest of the portal.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Palette, Send, ArrowRight, Users, MessageSquare, Luggage, FileText, Plane } from 'lucide-react';
import { AgencyShell, useAgencyMe, Callout, P, SERIF, card } from './portal-chrome';

interface Stats {
  travellers: number;
  opened: number;
  upcomingDepartures: number;
  pendingInvites: number;
  unreadReplies: number;
}
interface Departure { name: string; destination: string | null; departureDate: string | null }
interface Overview { stats: Stats; nextDepartures: Departure[] }

function Dashboard() {
  const { me } = useAgencyMe();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/overview', { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const appName = me.branding.appName || me.agency.name;
  const primary = me.branding.brandPrimaryColour || P.navy;
  const stats = data?.stats;
  const hasTravellers = (stats?.travellers ?? 0) > 0;

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: P.tealDark }}>
        Welcome back
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1.08, color: P.ink, margin: '6px 0 0' }}>
        {me.agency.name}
      </h1>
      <p style={{ color: P.ink2, fontSize: 15, marginTop: 10, lineHeight: 1.55, maxWidth: 520 }}>
        Your travellers&rsquo; app opens as{' '}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: P.ink }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: primary, display: 'inline-block' }} />
          {appName}
        </span>
        .
      </p>

      {/* Needs attention */}
      {stats && stats.unreadReplies > 0 && (
        <Link href="/agency/messages" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '12px 15px', borderRadius: 14, background: `${P.teal}12`, border: `1px solid ${P.teal}44` }} className="portal-lift">
            <MessageSquare size={18} color={P.tealDark} />
            <span style={{ fontSize: 14, color: P.ink, fontWeight: 600 }}>
              {stats.unreadReplies} new {stats.unreadReplies === 1 ? 'reply' : 'replies'} from your travellers
            </span>
            <ArrowRight size={16} color={P.tealDark} style={{ marginLeft: 'auto' }} />
          </div>
        </Link>
      )}

      {/* Stats */}
      {loading && !stats ? (
        <p style={{ color: P.ink3, fontSize: 13, marginTop: 18 }}>Loading…</p>
      ) : hasTravellers ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 18 }}>
          <Stat label="Travellers" value={stats!.travellers} />
          <Stat label="Opened the app" value={stats!.opened} sub={stats!.travellers ? `${Math.round((stats!.opened / stats!.travellers) * 100)}%` : undefined} />
          <Stat label="Departing (30 days)" value={stats!.upcomingDepartures} />
          <Stat label="Invites pending" value={stats!.pendingInvites} />
        </div>
      ) : (
        <div style={{ marginTop: 18 }}>
          <Callout title="Getting started">
            Brand your app so it feels like yours, add <strong>Trips</strong> and <strong>Documents</strong>{' '}
            for any bookings that aren&rsquo;t in Travelify, then send your traveller their access — they&rsquo;ll
            have your app on their phone in seconds.
          </Callout>
        </div>
      )}

      {/* Next departures */}
      {data?.nextDepartures && data.nextDepartures.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 18, color: P.ink, margin: '0 0 10px' }}>Next departures</h2>
          <div style={{ ...card, overflow: 'hidden' }}>
            {data.nextDepartures.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', borderTop: i === 0 ? 'none' : `1px solid ${P.line}` }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: `${P.navy}0d`, color: P.navy, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plane size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: P.ink }}>{d.name}</div>
                  {d.destination && <div style={{ fontSize: 12.5, color: P.ink3 }}>{d.destination}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: P.ink2, whiteSpace: 'nowrap' }}>{fmtDate(d.departureDate)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <h2 style={{ fontFamily: SERIF, fontSize: 18, color: P.ink, margin: '24px 0 10px' }}>Quick actions</h2>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Action href="/agency/access" icon={<Send size={20} strokeWidth={1.9} />} title="Send app access" body="Create a sign-in link + QR for a booking." />
        <Action href="/agency/messages" icon={<MessageSquare size={20} strokeWidth={1.9} />} title="Messages" body="Message a traveller and see their replies." />
        <Action href="/agency/travellers" icon={<Users size={20} strokeWidth={1.9} />} title="Travellers" body="Who has access and who's opened the app." />
        <Action href="/agency/branding" icon={<Palette size={20} strokeWidth={1.9} />} title="App branding" body="Your app name, colours, welcome and logo." />
        <Action href="/agency/trips" icon={<Luggage size={20} strokeWidth={1.9} />} title="Trips" body="Build a manual itinerary for off-Travelify bookings." />
        <Action href="/agency/documents" icon={<FileText size={20} strokeWidth={1.9} />} title="Documents" body="Upload documents for a booking." />
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{ ...card, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: P.navy, fontFamily: SERIF }}>{value}</span>
        {sub && <span style={{ fontSize: 13, fontWeight: 700, color: P.tealDark }}>{sub}</span>}
      </div>
      <div style={{ fontSize: 12, color: P.ink3, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Action({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link href={href} style={{ ...card, display: 'block', padding: 18, textDecoration: 'none' }} className="portal-lift">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `linear-gradient(135deg, ${P.navy}, ${P.navyLight})`, color: P.tealLight, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{title}</span>
        <ArrowRight size={17} style={{ marginLeft: 'auto', color: P.teal }} />
      </div>
      <p style={{ color: P.ink2, fontSize: 13, marginTop: 10, lineHeight: 1.45 }}>{body}</p>
    </Link>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function AgencyHomePage() {
  return (
    <AgencyShell active="overview">
      <Dashboard />
    </AgencyShell>
  );
}
