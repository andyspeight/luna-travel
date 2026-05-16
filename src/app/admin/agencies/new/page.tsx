'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Check, Sparkles, Zap, Flame,
  Bell, Plane, Clock, Image as ImageIcon, KeyRound,
  CheckCircle2, AlertCircle, Globe, Building2, User, MapPin,
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

const STEPS = [
  { id: 'basics',      label: 'Basics',      shortLabel: 'Basics' },
  { id: 'tier',        label: 'Tier',        shortLabel: 'Tier' },
  { id: 'branding',    label: 'Branding',    shortLabel: 'Branding' },
  { id: 'credentials', label: 'Travelify',   shortLabel: 'Travelify' },
  { id: 'review',      label: 'Review',      shortLabel: 'Review' },
] as const;

type StepId = typeof STEPS[number]['id'];

type WizardState = {
  name: string;
  contactEmail: string;
  city: string;
  tier: 'Spark' | 'Boost' | 'Ignite' | '';
  appName: string;
  primary: string;
  accent: string;
  welcome: string;
  travelifyAppId: string;
  travelifyUsername: string;
  travelifyKey: string;
  travelifyTested: boolean;
};

const initialState: WizardState = {
  name: '',
  contactEmail: '',
  city: '',
  tier: '',
  appName: '',
  primary: '#1B2B5B',
  accent: '#00B4D8',
  welcome: '',
  travelifyAppId: '250',
  travelifyUsername: '',
  travelifyKey: '',
  travelifyTested: false,
};

// ============ PRIMITIVES ============

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 12, backgroundColor: C.bgElevated,
      border: `1px solid ${C.border}`, overflow: 'hidden',
      ...style,
    }}>{children}</div>
  );
}

function Button({ children, variant = 'primary', onClick, disabled, leftIcon, rightIcon }: { children: React.ReactNode; variant?: 'primary' | 'secondary'; onClick?: () => void; disabled?: boolean; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const styles = variant === 'primary'
    ? { bg: disabled ? C.textTertiary : (hover ? C.primaryLight : C.primary), fg: '#fff', border: 'none' }
    : { bg: hover && !disabled ? C.bg : C.bgElevated, fg: C.text, border: `1px solid ${C.border}` };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '0 16px', height: 40, borderRadius: 8,
        backgroundColor: styles.bg, color: styles.fg, border: styles.border,
        fontSize: 14, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background-color 150ms',
      }}
    >
      {leftIcon}{children}{rightIcon}
    </button>
  );
}

function Input({ value, onChange, placeholder, type = 'text', error }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: boolean }) {
  const [focused, setFocused] = useState(false);
  const borderColour = error ? C.error : focused ? C.accent : C.border;
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: '100%', height: 40, padding: '0 12px',
        borderRadius: 8,
        border: `1px solid ${borderColour}`,
        backgroundColor: C.bgElevated, color: C.text,
        fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
        outline: 'none',
        boxShadow: focused && !error ? '0 0 0 3px rgba(0,180,216,0.15)' : error ? '0 0 0 3px rgba(239,68,68,0.12)' : 'none',
        transition: 'border-color 150ms, box-shadow 150ms',
      }}
    />
  );
}

function FormField({ label, helper, error, required, children }: { label: string; helper?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.error, marginLeft: 2 }} aria-hidden>*</span>}
      </label>
      {children}
      {error
        ? <div style={{ fontSize: 12, color: C.error, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertCircle style={{ height: 12, width: 12 }} strokeWidth={2} /> {error}
          </div>
        : helper && <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 6 }}>{helper}</div>
      }
    </div>
  );
}

// ============ STEPPER ============

function Stepper({ current, completed }: { current: StepId; completed: Set<StepId> }) {
  const currentIdx = STEPS.findIndex(s => s.id === current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 32 }}>
      {STEPS.map((step, i) => {
        const isCurrent = step.id === current;
        const isDone = completed.has(step.id);
        const isPast = i < currentIdx;
        const fg = isCurrent || isPast || isDone ? C.primary : C.textTertiary;
        const bg = isCurrent ? C.primary : (isDone || isPast) ? C.success : C.bgTertiary;
        const textColour = isCurrent || isDone || isPast ? '#fff' : C.textTertiary;
        return (
          <React.Fragment key={step.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{
                height: 28, width: 28, borderRadius: '50%',
                backgroundColor: bg, color: textColour,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, flexShrink: 0,
                transition: 'background-color 200ms',
              }}>
                {(isDone || isPast) && !isCurrent ? <Check style={{ height: 14, width: 14 }} strokeWidth={2.5} /> : i + 1}
              </div>
              <span style={{
                fontSize: 13, fontWeight: isCurrent ? 600 : 500, color: fg,
                whiteSpace: 'nowrap',
              }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, backgroundColor: i < currentIdx ? C.success : C.bgTertiary, borderRadius: 1, transition: 'background-color 200ms' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============ STEPS ============

function BasicsStep({ state, setState, errors }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; errors: Partial<Record<keyof WizardState, string>> }) {
  return (
    <Card>
      <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>Tell us about the agency</h2>
        <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>
          The basics — who they are and where they&apos;re based.
        </div>
      </div>
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
        <FormField label="Agency name" required error={errors.name} helper="The legal or trading name. Shown in your admin only.">
          <Input value={state.name} onChange={(v) => setState(s => ({ ...s, name: v }))} placeholder="Coast & Crown Travel" error={!!errors.name} />
        </FormField>
        <FormField label="Primary contact email" required error={errors.contactEmail} helper="Where we send invitation links and important alerts.">
          <Input value={state.contactEmail} onChange={(v) => setState(s => ({ ...s, contactEmail: v }))} placeholder="sophie@example.co.uk" type="email" error={!!errors.contactEmail} />
        </FormField>
        <FormField label="City" required error={errors.city}>
          <Input value={state.city} onChange={(v) => setState(s => ({ ...s, city: v }))} placeholder="Brighton" error={!!errors.city} />
        </FormField>
      </div>
    </Card>
  );
}

function TierStep({ state, setState }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>> }) {
  const tiers = [
    {
      id: 'Spark' as const,
      icon: Sparkles,
      price: '£159/mo',
      setup: '£2,995 setup',
      tagline: 'Get started fast',
      features: ['Up to 100 travellers', 'Standard PWA branding', 'Email support', 'Travelify integration'],
      accentColour: C.textSecondary,
      bg: C.bgTertiary,
    },
    {
      id: 'Boost' as const,
      icon: Zap,
      price: '£229/mo',
      setup: '£2,995 setup',
      tagline: 'Most popular',
      features: ['Up to 500 travellers', 'Full white-label', 'Push notifications', 'Priority support'],
      accentColour: C.info,
      bg: C.infoSoft,
    },
    {
      id: 'Ignite' as const,
      icon: Flame,
      price: '£299/mo',
      setup: '£3,995 setup',
      tagline: 'For agencies scaling fast',
      features: ['Unlimited travellers', 'Native app store build', 'Custom domain', 'Dedicated account manager'],
      accentColour: C.warning,
      bg: C.warningSoft,
    },
  ];

  return (
    <Card>
      <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>Choose a tier</h2>
        <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>
          Pick what fits the agency&apos;s scale. You can change this later.
        </div>
      </div>
      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {tiers.map(t => {
          const Icon = t.icon;
          const selected = state.tier === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setState(s => ({ ...s, tier: t.id }))}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12,
                padding: 20, borderRadius: 12,
                backgroundColor: C.bgElevated,
                border: `2px solid ${selected ? C.primary : C.border}`,
                cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 150ms, transform 150ms',
                transform: selected ? 'translateY(-2px)' : 'none',
                boxShadow: selected ? '0 8px 16px rgba(27,43,91,0.12)' : 'none',
              }}
            >
              {selected && (
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  height: 24, width: 24, borderRadius: '50%',
                  backgroundColor: C.primary, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check style={{ height: 14, width: 14 }} strokeWidth={2.5} />
                </div>
              )}
              <div style={{
                height: 40, width: 40, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: t.bg, color: t.accentColour,
              }}>
                <Icon style={{ height: 20, width: 20 }} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{t.id}</div>
                <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>{t.tagline}</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1 }}>{t.price}</div>
                <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 4 }}>{t.setup}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {t.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: C.textSecondary }}>
                    <Check style={{ height: 14, width: 14, color: C.success, flexShrink: 0, marginTop: 2 }} strokeWidth={2} />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function BrandingStep({ state, setState, errors }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; errors: Partial<Record<keyof WizardState, string>> }) {
  const previewName = state.appName || state.name || 'Your Agency';
  const welcomeShown = state.welcome || `Welcome to ${previewName}, your trip is just a tap away.`;

  return (
    <Card>
      <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>Branding</h2>
        <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>
          How the app looks on the traveller&apos;s phone. You can change this anytime.
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 0 }}>
        <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20, borderRight: `1px solid ${C.border}` }}>
          <FormField label="App display name" required error={errors.appName} helper="Shown on the install screen and at the top of every traveller's app.">
            <Input value={state.appName} onChange={(v) => setState(s => ({ ...s, appName: v }))} placeholder="e.g. Coast & Crown" error={!!errors.appName} />
          </FormField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormField label="Primary colour">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="color"
                  value={state.primary}
                  onChange={(e) => setState(s => ({ ...s, primary: e.target.value }))}
                  style={{ height: 40, width: 48, padding: 2, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, cursor: 'pointer' }}
                />
                <Input value={state.primary} onChange={(v) => setState(s => ({ ...s, primary: v }))} />
              </div>
            </FormField>
            <FormField label="Accent colour">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="color"
                  value={state.accent}
                  onChange={(e) => setState(s => ({ ...s, accent: e.target.value }))}
                  style={{ height: 40, width: 48, padding: 2, borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: C.bgElevated, cursor: 'pointer' }}
                />
                <Input value={state.accent} onChange={(v) => setState(s => ({ ...s, accent: v }))} />
              </div>
            </FormField>
          </div>

          <FormField label="Welcome message" helper="Shown the first time a traveller opens the app. Leave blank for a sensible default.">
            <textarea
              value={state.welcome}
              onChange={(e) => setState(s => ({ ...s, welcome: e.target.value }))}
              rows={2}
              placeholder={`Welcome to ${previewName}, your trip is just a tap away.`}
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
              <Button variant="secondary">Upload</Button>
              <span style={{ fontSize: 12, color: C.textTertiary }}>Optional — initials are used if no logo</span>
            </div>
          </FormField>
        </div>

        {/* Live phone preview */}
        <div style={{ padding: '24px 32px', backgroundColor: C.bg }}>
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
                <div style={{ padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>9:41</span>
                  <span style={{ color: C.textTertiary }}>● ● ●</span>
                </div>
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
                      backgroundColor: state.primary,
                    }}>
                      {previewName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewName}</span>
                  </div>
                  <Bell style={{ height: 14, width: 14, color: C.textTertiary, flexShrink: 0 }} strokeWidth={1.75} />
                </div>
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>Your trip</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>Faro, Portugal</div>
                  <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock style={{ height: 12, width: 12 }} strokeWidth={1.75} /> Departs in 12 days
                  </div>
                </div>
                <div style={{
                  margin: '0 16px', borderRadius: 12, padding: 16, color: '#fff',
                  background: `linear-gradient(135deg, ${state.primary}, ${state.primary}dd)`,
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
                <div style={{ padding: '16px' }}>
                  <button style={{
                    width: '100%', height: 40, borderRadius: 8, border: 'none',
                    color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    backgroundColor: state.accent,
                  }}>View itinerary</button>
                </div>
                <div style={{ padding: '0 16px' }}>
                  <span style={{ fontSize: 11, color: C.textTertiary, fontStyle: 'italic' }}>&ldquo;{welcomeShown}&rdquo;</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.textTertiary, marginTop: 12, textAlign: 'center' }}>
              Reflects your choices in real time
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CredentialsStep({ state, setState, errors }: { state: WizardState; setState: React.Dispatch<React.SetStateAction<WizardState>>; errors: Partial<Record<keyof WizardState, string>> }) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'failed'>('idle');

  const handleTest = () => {
    if (!state.travelifyUsername || !state.travelifyKey) return;
    setTesting(true);
    setTestResult('idle');
    setTimeout(() => {
      setTesting(false);
      // Simulate: succeed if both fields look plausible
      const succeed = state.travelifyUsername.length > 3 && state.travelifyKey.length > 8;
      setTestResult(succeed ? 'success' : 'failed');
      setState(s => ({ ...s, travelifyTested: succeed }));
    }, 1200);
  };

  return (
    <Card>
      <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>Travelify credentials</h2>
        <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>
          So we can pull bookings into the app. Encrypted at rest with AES-256-GCM.
        </div>
      </div>
      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
        <FormField label="App ID" required>
          <Input value={state.travelifyAppId} onChange={(v) => setState(s => ({ ...s, travelifyAppId: v, travelifyTested: false }))} />
        </FormField>
        <FormField label="API Username" required error={errors.travelifyUsername}>
          <Input value={state.travelifyUsername} onChange={(v) => setState(s => ({ ...s, travelifyUsername: v, travelifyTested: false }))} placeholder="e.g. coast-and-crown-api" error={!!errors.travelifyUsername} />
        </FormField>
        <FormField label="API Key" required error={errors.travelifyKey}>
          <Input value={state.travelifyKey} onChange={(v) => setState(s => ({ ...s, travelifyKey: v, travelifyTested: false }))} type="password" placeholder="••••••••••••••••" error={!!errors.travelifyKey} />
        </FormField>

        <div style={{
          padding: 16, borderRadius: 10,
          backgroundColor: testResult === 'success' ? C.successSoft : testResult === 'failed' ? C.errorSoft : C.bg,
          border: `1px solid ${testResult === 'success' ? C.success : testResult === 'failed' ? C.error : C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              height: 32, width: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: C.bgElevated,
            }}>
              {testResult === 'success' ? <CheckCircle2 style={{ height: 16, width: 16, color: C.success }} strokeWidth={1.75} />
                : testResult === 'failed' ? <AlertCircle style={{ height: 16, width: 16, color: C.error }} strokeWidth={1.75} />
                : <KeyRound style={{ height: 16, width: 16, color: C.textTertiary }} strokeWidth={1.75} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>
                {testResult === 'success' ? 'Connection successful' : testResult === 'failed' ? 'Connection failed' : 'Test the connection'}
              </div>
              <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>
                {testResult === 'success' ? 'Travelify recognises these credentials. You can proceed.'
                  : testResult === 'failed' ? 'Travelify rejected the credentials. Double-check the username and key.'
                  : 'We recommend testing before launching the agency.'}
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handleTest}
              disabled={testing || !state.travelifyUsername || !state.travelifyKey}
            >
              {testing ? 'Testing...' : 'Test connection'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReviewStep({ state }: { state: WizardState }) {
  const previewName = state.appName || state.name || 'Your Agency';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: C.text, margin: 0 }}>Ready to launch</h2>
          <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4 }}>
            Review the details below. You can change any of this after launch.
          </div>
        </div>
        <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <ReviewBlock icon={Building2} title="Agency">
            <ReviewLine label="Name" value={state.name} />
            <ReviewLine label="City" value={state.city} />
            <ReviewLine label="Contact" value={state.contactEmail} />
          </ReviewBlock>
          <ReviewBlock icon={Sparkles} title="Tier">
            <ReviewLine label="Plan" value={state.tier} />
          </ReviewBlock>
          <ReviewBlock icon={User} title="Branding">
            <ReviewLine label="App name" value={state.appName} />
            <ReviewLine label="Primary" value={state.primary} swatch={state.primary} />
            <ReviewLine label="Accent" value={state.accent} swatch={state.accent} />
          </ReviewBlock>
          <ReviewBlock icon={KeyRound} title="Travelify">
            <ReviewLine label="App ID" value={state.travelifyAppId} />
            <ReviewLine label="Username" value={state.travelifyUsername} />
            <ReviewLine label="API Key" value={state.travelifyKey ? '•••• •••• •••• ' + state.travelifyKey.slice(-4) : ''} />
            <ReviewLine label="Tested" value={state.travelifyTested ? 'Yes' : 'No'} valueColour={state.travelifyTested ? C.success : C.warning} />
          </ReviewBlock>
        </div>
      </Card>

      {!state.travelifyTested && (
        <div style={{
          padding: 16, borderRadius: 10,
          backgroundColor: C.warningSoft,
          border: `1px solid ${C.warning}`,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <AlertCircle style={{ height: 16, width: 16, color: C.warning, flexShrink: 0, marginTop: 2 }} strokeWidth={1.75} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Travelify connection not tested</div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>
              The agency will be created in <strong>Setup</strong> status. No traveller can install the app until you test the credentials and move the agency to Live.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewBlock({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: 16, borderRadius: 10, backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon style={{ height: 14, width: 14, color: C.textTertiary }} strokeWidth={1.75} />
        <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function ReviewLine({ label, value, swatch, valueColour }: { label: string; value: string; swatch?: string; valueColour?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: C.textTertiary }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {swatch && <span style={{ height: 16, width: 16, borderRadius: 4, backgroundColor: swatch, border: `1px solid ${C.border}`, flexShrink: 0 }} />}
        <span style={{ fontSize: 13, fontWeight: 500, color: valueColour ?? C.text, fontFamily: swatch ? 'ui-monospace, monospace' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || <span style={{ color: C.textTertiary, fontStyle: 'italic' }}>not set</span>}
        </span>
      </div>
    </div>
  );
}

// ============ MAIN PAGE ============

export default function NewAgencyWizard() {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(initialState);
  const [step, setStep] = useState<StepId>('basics');
  const [completed, setCompleted] = useState<Set<StepId>>(new Set());
  const [launching, setLaunching] = useState(false);

  // Per-step validation
  const errors = useMemo(() => {
    const e: Partial<Record<keyof WizardState, string>> = {};
    if (step === 'basics') {
      // Only validate after user has interacted; simplest: empty == undefined error
    }
    return e;
  }, [step]);

  const validateStep = (s: StepId): Partial<Record<keyof WizardState, string>> => {
    const e: Partial<Record<keyof WizardState, string>> = {};
    if (s === 'basics') {
      if (!state.name.trim()) e.name = 'Required';
      if (!state.contactEmail.trim()) e.contactEmail = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.contactEmail)) e.contactEmail = 'Enter a valid email address';
      if (!state.city.trim()) e.city = 'Required';
    }
    if (s === 'tier') {
      if (!state.tier) {
        // Visual only — disable Next button rather than show field error
      }
    }
    if (s === 'branding') {
      if (!state.appName.trim()) e.appName = 'Required';
    }
    if (s === 'credentials') {
      if (!state.travelifyUsername.trim()) e.travelifyUsername = 'Required';
      if (!state.travelifyKey.trim()) e.travelifyKey = 'Required';
    }
    return e;
  };

  const [shownErrors, setShownErrors] = useState<Partial<Record<keyof WizardState, string>>>({});

  const canProceed = useMemo(() => {
    if (step === 'tier') return state.tier !== '';
    const e = validateStep(step);
    return Object.keys(e).length === 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, state]);

  const handleNext = () => {
    const e = validateStep(step);
    if (Object.keys(e).length > 0) {
      setShownErrors(e);
      return;
    }
    setShownErrors({});
    setCompleted(prev => new Set(prev).add(step));
    const idx = STEPS.findIndex(s => s.id === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].id);
  };

  const handleBack = () => {
    const idx = STEPS.findIndex(s => s.id === step);
    if (idx > 0) {
      setShownErrors({});
      setStep(STEPS[idx - 1].id);
    }
  };

  const handleLaunch = () => {
    setLaunching(true);
    // Simulate API call; in real life this POSTs to /api/admin/agencies
    setTimeout(() => {
      // Go to the (still mock) detail page for the newly created agency
      router.push('/admin/agencies');
    }, 1200);
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
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
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
          Travelgenix admin
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
          New agency
        </h1>
      </div>

      {/* Stepper */}
      <Stepper current={step} completed={completed} />

      {/* Step content */}
      {step === 'basics' && <BasicsStep state={state} setState={setState} errors={shownErrors} />}
      {step === 'tier' && <TierStep state={state} setState={setState} />}
      {step === 'branding' && <BrandingStep state={state} setState={setState} errors={shownErrors} />}
      {step === 'credentials' && <CredentialsStep state={state} setState={setState} errors={shownErrors} />}
      {step === 'review' && <ReviewStep state={state} />}

      {/* Navigation footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32 }}>
        <Button
          variant="secondary"
          onClick={handleBack}
          disabled={step === 'basics' || launching}
          leftIcon={<ChevronLeft style={{ height: 14, width: 14 }} strokeWidth={1.75} />}
        >Back</Button>

        <div style={{ fontSize: 13, color: C.textTertiary }}>
          Step {STEPS.findIndex(s => s.id === step) + 1} of {STEPS.length}
        </div>

        {step === 'review' ? (
          <Button onClick={handleLaunch} disabled={launching}>
            {launching ? 'Launching...' : 'Launch agency'}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!canProceed}
            rightIcon={<ChevronRight style={{ height: 14, width: 14 }} strokeWidth={1.75} />}
          >Next</Button>
        )}
      </div>
    </div>
  );
}
