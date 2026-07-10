'use client';

/**
 * /agency — the portal home for a signed-in Luna-native agency. Two jobs:
 * set up the app branding, and send a traveller access to a booking's app.
 */

import Link from 'next/link';
import { AgencyShell, useAgencyMe } from './portal-chrome';

function Dashboard() {
  const { me } = useAgencyMe();
  const appName = me.branding.appName || me.agency.name;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>
        Welcome{me.agency.name ? `, ${me.agency.name}` : ''}
      </h1>
      <p style={{ color: '#64748b', fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
        This is where you set up your travellers&rsquo; app and send them access. Your app is
        currently branded as <strong style={{ color: '#0f172a' }}>{appName}</strong>.
      </p>

      <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
        <ActionCard
          href="/agency/branding"
          title="App branding"
          body="Set your app name, colours, welcome message and logo. Travellers see this the moment they open their trip."
        />
        <ActionCard
          href="/agency/access"
          title="Send app access"
          body="Create a sign-in link and QR code for a booking, so your traveller can open their trip in the app."
        />
      </div>
    </div>
  );
}

function ActionCard({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: 18,
        textDecoration: 'none',
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</span>
        <span style={{ marginLeft: 'auto', color: '#4f46e5', fontSize: 18 }}>→</span>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{body}</p>
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
