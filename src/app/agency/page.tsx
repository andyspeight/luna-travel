'use client';

/**
 * /agency — the portal home for a signed-in Luna-native agency. Two jobs:
 * set up the app branding, and send a traveller access to a booking's app.
 */

import Link from 'next/link';
import { Palette, Send, ArrowRight } from 'lucide-react';
import { AgencyShell, useAgencyMe, Callout, P, SERIF, card } from './portal-chrome';

function Dashboard() {
  const { me } = useAgencyMe();
  const appName = me.branding.appName || me.agency.name;
  const primary = me.branding.brandPrimaryColour || P.navy;

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: P.tealDark }}>
        Welcome back
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 34, lineHeight: 1.08, color: P.ink, margin: '6px 0 0' }}>
        {me.agency.name}
      </h1>
      <p style={{ color: P.ink2, fontSize: 15, marginTop: 10, lineHeight: 1.55, maxWidth: 520 }}>
        Set up your travellers&rsquo; app and send them access — all from here. Your app currently
        opens as{' '}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: P.ink }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: primary, display: 'inline-block' }} />
          {appName}
        </span>
        .
      </p>

      <div style={{ marginTop: 20 }}>
        <Callout title="Two steps to launch">
          Brand your app so it feels like yours, then send a traveller their access. That&rsquo;s it —
          they&rsquo;ll have your app on their phone in seconds.
        </Callout>
      </div>

      <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        <ActionCard
          step={1}
          href="/agency/branding"
          icon={<Palette size={22} strokeWidth={1.9} />}
          title="App branding"
          body="Your app name, colours, welcome message and logo. Travellers see this the moment they open their trip."
        />
        <ActionCard
          step={2}
          href="/agency/access"
          icon={<Send size={22} strokeWidth={1.9} />}
          title="Send app access"
          body="Create a sign-in link and QR code for a booking, so your traveller can open their trip in the app."
        />
      </div>
    </div>
  );
}

function ActionCard({ step, href, icon, title, body }: { step: number; href: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link href={href} style={{ ...card, display: 'block', padding: 20, textDecoration: 'none' }} className="portal-lift">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <span
          style={{
            position: 'relative',
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: `linear-gradient(135deg, ${P.navy}, ${P.navyLight})`,
            color: P.tealLight, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {icon}
          <span style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 999, background: P.teal, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,180,216,0.5)' }}>
            {step}
          </span>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: P.ink }}>{title}</span>
            <ArrowRight size={18} style={{ marginLeft: 'auto', color: P.teal }} />
          </div>
          <p style={{ color: P.ink2, fontSize: 13.5, marginTop: 5, lineHeight: 1.5 }}>{body}</p>
        </div>
      </div>
    </Link>
  );
}

export default function AgencyHomePage() {
  return (
    <AgencyShell active="overview">
      <Dashboard />
    </AgencyShell>
  );
}
