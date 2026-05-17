'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  primary: '#1B2B5B',
  accent: '#00B4D8',
  error: '#EF4444',
  errorSoft: '#FEF2F2',
};

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnPath = params.get('return') || '/admin/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "We couldn't sign you in. Check your email and password.");
        return;
      }
      // Safe redirect — must start with / and not be a protocol-relative URL
      const safeReturn = returnPath.startsWith('/') && !returnPath.startsWith('//')
        ? returnPath
        : '/admin/dashboard';
      router.push(safeReturn);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = email.trim().length > 5 && password.length >= 6 && !submitting;

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
      }}>
        {/* Brand mark */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
              color: '#fff', fontWeight: 700, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>L</span>
            <span style={{ fontSize: 17, fontWeight: 600, color: C.text, letterSpacing: '-0.01em' }}>
              Luna Travel
            </span>
          </div>
          <div style={{
            fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: C.textTertiary, fontWeight: 600,
          }}>
            Travelgenix admin
          </div>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: C.bgElevated,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
        }}>
          <h1 style={{
            fontSize: 22, fontWeight: 600, color: C.text, margin: 0,
            letterSpacing: '-0.01em', marginBottom: 6,
          }}>
            Sign in
          </h1>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, marginBottom: 24 }}>
            Restricted to Travelgenix and Agendas Group staff.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }}
                placeholder="you@travelgenix.io"
                autoComplete="email"
                autoFocus
                style={inputStyle}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }}
                autoComplete="current-password"
                style={inputStyle}
              />
            </Field>

            {error && (
              <div style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: C.errorSoft,
                border: `1px solid ${C.error}`,
                fontSize: 13,
                color: C.text,
              }}>
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              style={{
                width: '100%', height: 44,
                borderRadius: 10, border: 'none',
                backgroundColor: canSubmit ? C.primary : C.textTertiary,
                color: '#fff', fontSize: 14, fontWeight: 500,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'background-color 150ms',
                marginTop: 6,
              }}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 11, color: C.textTertiary, letterSpacing: '0.04em',
        }}>
          Coming soon: sign in with your Travelgenix account.
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontSize: 12, fontWeight: 500, color: C.text,
        marginBottom: 5,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 42,
  padding: '0 12px',
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  backgroundColor: C.bgElevated,
  color: C.text,
  fontSize: 14,
  lineHeight: 1.5,
  fontFamily: 'inherit',
  outline: 'none',
};
