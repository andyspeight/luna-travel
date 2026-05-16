'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, PauseCircle, MoreHorizontal,
  CheckCircle2, AlertTriangle, KeyRound, Eye, EyeOff, Copy,
  Globe, Image as ImageIcon, Bell, Plane, Clock, Users, Shield,
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
  primaryLight: '#2A3F7A',
  accent: '#00B4D8',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  error: '#EF4444',
  errorSoft: '#FEF2F2',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

const AGENCIES = [
  { id: 'agc_7k2n', name: 'Coast & Crown Travel', tier: 'Ignite', status: 'live', travellers: 847, activeTrips: 124, lastSync: '2m ago', primary: '#0F4C5C', accent: '#E36414', appName: 'Coast & Crown', contact: 'sophie@coastandcrown.co.uk', city: 'Brighton', joined: 'Feb 2026', deviceInstalls: 612, last30dActives: 489 },
  { id: 'agc_3p8m', name: 'Mercia Holidays', tier: 'Boost', status: 'live', travellers: 312, activeTrips: 47, lastSync: '14m ago', primary: '#1B2B5B', accent: '#00B4D8', appName: 'Mercia Trips', contact: 'bookings@merciaholidays.com', city: 'Worcester', joined: 'Mar 2026', deviceInstalls: 198, last30dActives: 156 },
  { id: 'agc_9w1q', name: 'Elite Bespoke', tier: 'Ignite', status: 'live', travellers: 1247, activeTrips: 203, lastSync: '47s ago', primary: '#0A0A0A', accent: '#C9A961', appName: 'Elite', contact: 'concierge@elitebespoke.travel', city: 'Mayfair', joined: 'Jan 2026', deviceInstalls: 1024, last30dActives: 891 },
  { id: 'agc_2v6r', name: 'Brackenwood Travel', tier: 'Boost', status: 'live', travellers: 234, activeTrips: 38, lastSync: '3m ago', primary: '#2D5016', accent: '#D4A574', appName: 'Brackenwood', contact: 'hello@brackenwoodtravel.co.uk', city: 'Kendal', joined: 'Apr 2026', deviceInstalls: 142, last30dActives: 98 },
  { id: 'agc_5x4t', name: 'Halcyon Days Travel', tier: 'Spark', status: 'setup', travellers: 0, activeTrips: 0, lastSync: 'never', primary: '#1B2B5B', accent: '#00B4D8', appName: 'Luna Travel', contact: 'mike@halcyondaystravel.co.uk', city: 'Cheltenham', joined: 'May 2026', deviceInstalls: 0, last30dActives: 0 },
  { id: 'agc_8h3y', name: 'Saltbreeze Travel', tier: 'Boost', status: 'paused', travellers: 178, activeTrips: 22, lastSync: '2d ago', primary: '#264653', accent: '#E9C46A', appName: 'Saltbreeze', contact: 'rachel@saltbreeze.travel', city: 'St Ives', joined: 'Mar 2026', deviceInstalls: 89, last30dActives: 0 },
  { id: 'agc_4n7c', name: 'Northstar Journeys', tier: 'Ignite', status: 'live', travellers: 567, activeTrips: 88, lastSync: '1m ago', primary: '#1A1A2E', accent: '#F5A623', appName: 'Northstar', contact: 'team@northstar.travel', city: 'Edinburgh', joined: 'Feb 2026', deviceInstalls: 412, last30dActives: 367 },
];

const SYNC_EVENTS_BY_AGENCY: Record<string, { ref: string; status: 'success' | 'failed'; time: string; detail: string }[]> = {
  agc_7k2n: [
    { ref: 'TG-491203', status: 'success', time: '14:32:08', detail: 'Booking updated · 2 documents added' },
    { ref: 'TG-491172', status: 'success', time: '14:25:19', detail: 'Booking updated' },
    { ref: 'TG-491098', status: 'success', time: '13:58:42', detail: 'New booking ingested · 4 documents' },
    { ref: 'TG-491041', status: 'success', time: '13:32:11', detail: 'Booking updated · flight time changed' },
  ],
  agc_2v6r: [
    { ref: 'TG-491187', status: 'failed', time: '14:29:11', detail: 'Travelify 401 — credentials need refresh' },
    { ref: 'TG-491168', status: 'failed', time: '14:23:02', detail: 'Travelify 401 — credentials need refresh' },
    { ref: 'TG-491022', status: 'success', time: '13:15:33', detail: 'Booking updated' },
  ],
};

// ============ SHARED PRIMITIVES ============

function StatusDot({ status }: { status: string }) {
  const colour = status === 'live' ? C.success : status === 'paused' ? C.textTertiary : status === 'setup' ? C.info : C.warning;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8 }}>
      {status === 'live' && (
        <span style={{
          position: 'absolute', display: 'inline-flex', height: '100%', width: '100%',
          borderRadius: '50%', opacity: 0.6, backgroundColor: colour,
          animation: 'tg-ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
        }} />
      )}
      <span style={{ position: 'relative', display: 'inline-flex', height: 8, width: 8, borderRadius: '50%', backgroundColor: colour }} />
    </span>
  );
}

function StatusLabel({ status, label }: { status: string; label: string }) {
  const colour = status === 'live' ? C.success : status === 'paused' ? C.textSecondary : status === 'setup' ? C.info : C.warning;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: colour }}>
      <StatusDot status={status} />{label}
    </span>
  );
}

function Pill({ tier }: { tier: string }) {
  const style = tier === 'Ignite'
    ? { bg: C.warningSoft, fg: C.warning }
    : tier === 'Boost'
    ? { bg: C.infoSoft, fg: C.info }
    : { bg: C.bgTertiary, fg: C.textSecondary };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
      backgroundColor: style.bg, color: style.fg,
    }}>{tier}</span>
  );
}

function Avatar({ name, bg, size = 'md' }: { name: string; bg: string; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 56 : 36;
  const fontSize = size === 'lg' ? 18 : 13;
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      height: dim, width: dim, borderRadius: size === 'lg' ? 12 : 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize, fontWeight: 600,
      flexShrink: 0, backgroundColor: bg,
    }}>{initials}</div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 12, backgroundColor: C.bgElevated,
      border: `1px solid ${C.border}`, overflow: 'hidden',
      ...style,
    }}>{children}</div>
  );
}

function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function Button({ children, variant = 'primary', onClick, leftIcon }: { children: React.ReactNode; variant?: 'primary' | 'secondary'; onClick?: () => void; leftIcon?: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const styles = variant === 'primary'
    ? { bg: hover ? C.primaryLight : C.primary, fg: '#fff', border: 'none' }
    : { bg: hover ? C.bg : C.bgElevated, fg: C.text, border: `1px solid ${C.border}` };
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '0 16px', height: 40, borderRadius: 8,
        backgroundColor: styles.bg, color: styles.fg, border: styles.border,
        fontSize: 14, fontWeight: 500, cursor: 'pointer',
        transition: 'background-color 150ms',
      }}
    >
      {leftIcon}{children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = 'text', readOnly = false }: { value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: '100%', height: 40, padding: '0 12px',
        borderRadius: 8,
        border: `1px solid ${focused ? C.accent : C.border}`,
        backgroundColor: readOnly ? C.bg : C.bgElevated,
        color: C.text, fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
        outline: 'none',
        boxShadow: focused ? '0 0 0 3px rgba(0,180,216,0.15)' : 'none',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    />
  );
}

function FormField({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>{label}</label>
      {children}
      {helper && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 6 }}>{helper}</div>}
    </div>
  );
}

// ============ TAB CONTENT ============

function OverviewTab({ agency }: { agency: typeof AGENCIES[0] }) {
  const events = SYNC_EVENTS_BY_AGENCY[agency.id] ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPIs */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { label: 'Travellers', value: agency.travellers.toLocaleString() },
            { label: 'Active trips', value: agency.activeTrips },
            { label: 'PWA installs', value: agency.deviceInstalls.toLocaleString() },
            { label: '30d active users', value: agency.last30dActives.toLocaleString() },
          ].map((m, i) => (
            <div key={i} style={{ padding: '20px 24px', borderLeft: i === 0 ? 'none' : `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8 }}>{m.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: C.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{m.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Sync activity */}
      <Card>
        <CardHeader title="Recent sync activity" subtitle="Last 24 hours" />
        <div>
          {events.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: C.textTertiary }}>
                No sync activity yet. First Travelify pull happens when the agency is moved out of Setup.
              </div>
            </div>
          ) : (
            events.map((e, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 24px',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
              }}>
                {e.status === 'success'
                  ? <CheckCircle2 style={{ height: 16, width: 16, color: C.success, flexShrink: 0 }} strokeWidth={1.75} />
                  : <AlertTriangle style={{ height: 16, width: 16, color: C.warning, flexShrink: 0 }} strokeWidth={1.75} />
                }
                <span style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace', color: C.textSecondary }}>{e.ref}</span>
                <span style={{ fontSize: 13, color: C.textTertiary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</span>
                <span style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: C.textTertiary, fontVariantNumeric: 'tabular-nums' }}>{e.time}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function BrandingTab({ agency }: { agency: typeof AGENCIES[0] }) {
  const [primary, setPrimary] = useState(agency.primary);
  const [accent, setAccent] = useState(agency.accent);
  const [appName, setAppName] = useState(agency.appName);
  const [welcome, setWelcome] = useState(`Welcome to ${agency.appName}, your trip is just a tap away.`);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
      {/* Form */}
      <Card>
        <CardHeader title="White-label settings" subtitle="Changes apply to all installed devices within a minute." />
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <FormField label="App display name" helper="Shown on the install screen and at the top of every traveller's app.">
            <Input value={appName} onChange={setAppName} />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="Primary colour">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="color"
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  style={{ height: 40, width: 48, padding: 2, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, cursor: 'pointer' }}
                />
                <Input value={primary} onChange={setPrimary} />
              </div>
            </FormField>
            <FormField label="Accent colour">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  style={{ height: 40, width: 48, padding: 2, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, cursor: 'pointer' }}
                />
                <Input value={accent} onChange={setAccent} />
              </div>
            </FormField>
          </div>

          <FormField label="Welcome message" helper="Shown the first time a traveller opens the app.">
            <textarea
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
              rows={2}
              style={{
                width: '100%', padding: 12, borderRadius: 8,
                border: `1px solid ${C.border}`,
                backgroundColor: C.bgElevated, color: C.text,
                fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical',
                outline: 'none', minHeight: 64,
              }}
            />
          </FormField>

          <FormField label="Logo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                height: 48, width: 48, borderRadius: 8,
                border: `1px dashed ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: C.bgTertiary,
              }}>
                <ImageIcon style={{ height: 16, width: 16, color: C.textTertiary }} strokeWidth={1.75} />
              </div>
              <Button variant="secondary">Upload light</Button>
              <Button variant="secondary">Upload dark</Button>
            </div>
          </FormField>

          <FormField label="Install page URL">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 12px', height: 40, borderRadius: 8,
              border: `1px solid ${C.border}`, backgroundColor: C.bg,
            }}>
              <Globe style={{ height: 14, width: 14, color: C.textTertiary, flexShrink: 0 }} strokeWidth={1.75} />
              <span style={{ fontSize: 13, fontFamily: 'ui-monospace, monospace', color: C.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                luna.travel/install/{agency.id}
              </span>
              <button style={{ padding: 4, borderRadius: 4, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}>
                <Copy style={{ height: 14, width: 14, color: C.textTertiary }} strokeWidth={1.75} />
              </button>
            </div>
          </FormField>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: `1px solid ${C.border}`, marginTop: 4 }}>
            <Button variant="secondary">Discard</Button>
            <Button>Save changes</Button>
          </div>
        </div>
      </Card>

      {/* Live phone preview */}
      <div>
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 8, padding: '0 4px' }}>
            Live preview
          </div>
          <div style={{
            borderRadius: 32, padding: 8,
            backgroundColor: '#0F172A',
            boxShadow: '0 20px 40px rgba(15,23,42,0.15)',
          }}>
            <div style={{
              borderRadius: 24, overflow: 'hidden',
              backgroundColor: C.bgElevated,
              aspectRatio: '9/16',
              position: 'relative',
            }}>
              {/* Status bar */}
              <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                <span style={{ color: C.text, fontWeight: 500 }}>9:41</span>
                <span style={{ color: C.textTertiary }}>● ● ●</span>
              </div>
              {/* App header */}
              <div style={{
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{
                    height: 28, width: 28, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 600, flexShrink: 0,
                    backgroundColor: primary,
                  }}>
                    {appName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appName}</span>
                </div>
                <Bell style={{ height: 14, width: 14, color: C.textTertiary, flexShrink: 0 }} strokeWidth={1.75} />
              </div>
              {/* Hero */}
              <div style={{ padding: '16px' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Your trip</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>Faro, Portugal</div>
                <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock style={{ height: 12, width: 12 }} strokeWidth={1.75} /> Departs in 12 days
                </div>
              </div>
              {/* Booking card */}
              <div style={{
                margin: '0 16px', borderRadius: 12, padding: 16, color: '#fff',
                background: `linear-gradient(135deg, ${primary}, ${primary}dd)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Plane style={{ height: 14, width: 14 }} strokeWidth={1.75} />
                  <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.8 }}>Outbound flight</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 600 }}>LGW</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>2h 50m</span>
                  <span style={{ fontSize: 18, fontWeight: 600 }}>FAO</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>28 May · 14:35 → 17:25</div>
              </div>
              {/* CTA */}
              <div style={{ padding: '16px' }}>
                <button style={{
                  width: '100%', height: 40, borderRadius: 8, border: 'none',
                  color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  backgroundColor: accent,
                }}>View itinerary</button>
              </div>
              {/* Welcome */}
              <div style={{ padding: '0 16px' }}>
                <span style={{ fontSize: 11, color: C.textTertiary, fontStyle: 'italic' }}>&ldquo;{welcome}&rdquo;</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 12, textAlign: 'center' }}>
            Reflects unsaved changes in real time
          </div>
        </div>
      </div>
    </div>
  );
}

function CredentialsTab({ agency }: { agency: typeof AGENCIES[0] }) {
  const [showSecret, setShowSecret] = useState(false);
  const [username, setUsername] = useState(`${agency.id.replace('agc_', '')}-api`);

  return (
    <div style={{ maxWidth: 640 }}>
      <Card>
        <CardHeader
          title="Travelify credentials"
          subtitle="Encrypted at rest with AES-256-GCM. Never displayed after save."
        />
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <FormField label="App ID">
            <Input value="250" readOnly />
          </FormField>
          <FormField label="API Username">
            <Input value={username} onChange={setUsername} />
          </FormField>
          <FormField label="API Key" helper="Last rotated 12 Feb 2026.">
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                value={showSecret ? 'tg_live_8e2c0f4a9b6d1e7f3a2c8d5b9e4f1a6c' : '•••• •••• •••• ••a6c'}
                type={showSecret ? 'text' : 'password'}
                readOnly
              />
              <button
                onClick={() => setShowSecret(s => !s)}
                style={{
                  height: 40, width: 40, borderRadius: 8,
                  border: `1px solid ${C.border}`, backgroundColor: C.bgElevated,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                }}
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? <EyeOff style={{ height: 16, width: 16, color: C.textSecondary }} strokeWidth={1.75} /> : <Eye style={{ height: 16, width: 16, color: C.textSecondary }} strokeWidth={1.75} />}
              </button>
            </div>
          </FormField>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <button style={{ fontSize: 13, color: C.textTertiary, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Rotate key
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button variant="secondary" leftIcon={<CheckCircle2 style={{ height: 14, width: 14, color: C.success }} strokeWidth={1.75} />}>
                Test connection
              </Button>
              <Button>Save</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function StubTab({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <Card>
      <div style={{ padding: '64px 32px', textAlign: 'center' }}>
        <Icon style={{ height: 32, width: 32, color: C.textTertiary, margin: '0 auto 12px' }} strokeWidth={1.5} />
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.textSecondary, maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </Card>
  );
}

// ============ PAGE ============

export default function AgencyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const agency = AGENCIES.find(a => a.id === id);
  const [tab, setTab] = useState<'overview' | 'branding' | 'credentials' | 'travellers' | 'audit'>('overview');

  if (!agency) {
    return (
      <div style={{ padding: '32px', maxWidth: 1440, margin: '0 auto' }}>
        <Card>
          <div style={{ padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>Agency not found</div>
            <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 16 }}>
              The agency with ID <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{id}</code> doesn&apos;t exist.
            </div>
            <Button onClick={() => router.push('/admin/agencies')} leftIcon={<ChevronLeft style={{ height: 14, width: 14 }} strokeWidth={1.75} />}>
              All agencies
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const TABS = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'branding' as const, label: 'White-label' },
    { id: 'credentials' as const, label: 'Travelify' },
    { id: 'travellers' as const, label: 'Travellers' },
    { id: 'audit' as const, label: 'Activity' },
  ];

  return (
    <>
      <style>{`
        @keyframes tg-ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
      <div style={{ padding: '32px', maxWidth: 1440, margin: '0 auto' }}>
        {/* Back link */}
        <Link
          href="/admin/agencies"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: C.textTertiary, textDecoration: 'none',
            marginBottom: 16,
          }}
        >
          <ChevronLeft style={{ height: 14, width: 14 }} strokeWidth={1.75} />
          All agencies
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Avatar name={agency.name} bg={agency.primary} size="lg" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>{agency.name}</h1>
                <Pill tier={agency.tier} />
                <StatusLabel
                  status={agency.status}
                  label={agency.status === 'live' ? 'Live' : agency.status === 'paused' ? 'Paused' : agency.status === 'setup' ? 'Setup' : 'Maintenance'}
                />
              </div>
              <div style={{ fontSize: 13, color: C.textTertiary, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'ui-monospace, monospace' }}>{agency.id}</span>
                <span>·</span><span>{agency.city}</span>
                <span>·</span><span>Joined {agency.joined}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="secondary" leftIcon={<PauseCircle style={{ height: 14, width: 14 }} strokeWidth={1.75} />}>
              {agency.status === 'paused' ? 'Resume' : 'Pause'}
            </Button>
            <button
              style={{
                height: 40, width: 40, borderRadius: 8,
                border: `1px solid ${C.border}`, backgroundColor: C.bgElevated,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="More actions"
            >
              <MoreHorizontal style={{ height: 16, width: 16, color: C.textSecondary }} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          borderBottom: `1px solid ${C.border}`, marginBottom: 24,
          overflowX: 'auto',
        }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '0 16px', height: 44,
                  fontSize: 14, fontWeight: 500,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: active ? C.text : C.textTertiary,
                  borderBottom: `2px solid ${active ? C.primary : 'transparent'}`,
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                  transition: 'color 150ms, border-color 150ms',
                }}
              >{t.label}</button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === 'overview' && <OverviewTab agency={agency} />}
        {tab === 'branding' && <BrandingTab agency={agency} />}
        {tab === 'credentials' && <CredentialsTab agency={agency} />}
        {tab === 'travellers' && <StubTab icon={Users} title="Traveller management" description="List, search, install status, device management. Wired to Luna Work as source of truth. Building this view next." />}
        {tab === 'audit' && <StubTab icon={Shield} title="Activity log" description="Every state change, who made it, when. Append-only." />}
      </div>
    </>
  );
}
