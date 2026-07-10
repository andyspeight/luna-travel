'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/**
 * Admin "signed out" landing.
 *
 * Luna Travel admin authenticates through Travelgenix ID (the central
 * `tg_session` SSO), not a local password. This page is where the sign-out
 * action lands; it simply confirms the session has ended and sends the admin
 * back into the panel, where the SSO gate re-authenticates them.
 *
 * (There is deliberately no email/password form here — local admin auth was
 * retired in favour of SSO, and there is no `/api/admin/signin` route.)
 */

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  primary: '#1B2B5B',
  accent: '#00B4D8',
};

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignedOut />
    </Suspense>
  );
}

function SignedOut() {
  const params = useSearchParams();
  const requested = params.get('return') || '/admin/dashboard';
  // Only honour an in-app path; never an absolute or protocol-relative URL.
  const returnPath =
    requested.startsWith('/') && !requested.startsWith('//') ? requested : '/admin/dashboard';

  return (
    <main style={{
      minHeight: '100vh',
      backgroundColor: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Brand mark */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
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
          textAlign: 'center',
        }}>
          <h1 style={{
            fontSize: 22, fontWeight: 600, color: C.text, margin: 0,
            letterSpacing: '-0.01em', marginBottom: 8,
          }}>
            You&rsquo;re signed out
          </h1>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, marginBottom: 24, lineHeight: 1.6 }}>
            Luna Travel admin uses your Travelgenix single sign-on. Continue to
            sign back in with your Travelgenix account.
          </p>

          <Link
            href={returnPath}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', height: 44,
              borderRadius: 10, border: 'none',
              backgroundColor: C.primary, color: '#fff',
              fontSize: 14, fontWeight: 500, textDecoration: 'none',
            }}
          >
            Continue to admin
          </Link>
        </div>

        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 11, color: C.textTertiary, letterSpacing: '0.04em',
        }}>
          Restricted to Travelgenix and Agendas Group staff.
        </p>
      </div>
    </main>
  );
}
