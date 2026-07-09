'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, ArrowLeft, ExternalLink } from 'lucide-react';

/**
 * "Add an agency" — informational.
 *
 * Agencies are NOT created in Luna Travel. Control (Travelgenix ID) is the
 * single source of truth for clients; Luna Travel stores no agency records and
 * simply reads the clients entitled to the `luna-travel` product. So there is
 * no create form here — this page explains how a new agency comes to exist and
 * appear in the list. (This replaced an earlier mock wizard that never
 * persisted and defaulted to the demo Travelify app.)
 */

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
};

const STEPS = [
  {
    title: 'Create or find the client in Control',
    body: 'In Travelgenix Control, open the client (agency) record — or create it there if it does not exist yet. Control is where clients and their Travelify credentials live.',
  },
  {
    title: 'Enable the Luna Travel product',
    body: 'On the client detail page, toggle on the “luna-travel” catalogue product. Only clients entitled to it appear in Luna Travel.',
  },
  {
    title: 'Set the agency’s Travelify credentials',
    body: 'Add the agency’s own Travelify App ID, Site ID and API key in Control. Luna Travel looks bookings up with each agency’s own credentials — never a shared demo account.',
  },
  {
    title: 'It appears here automatically',
    body: 'Back in Luna Travel, the agency shows in the Agencies list. From its detail page you can then upload documents, set branding, create invites and add off-platform bookings.',
  },
];

export default function AddAgencyPage() {
  return (
    <div style={{ padding: '32px', maxWidth: 760, margin: '0 auto' }}>
      <Link
        href="/admin/agencies"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: C.textSecondary, textDecoration: 'none', marginBottom: 20,
        }}
      >
        <ArrowLeft style={{ height: 14, width: 14 }} strokeWidth={1.75} />
        Agencies
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{
          height: 40, width: 40, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.primary}, ${C.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Building2 style={{ height: 20, width: 20, color: '#fff' }} strokeWidth={1.75} />
        </span>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary }}>
            Travelgenix admin
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
            Adding an agency
          </h1>
        </div>
      </div>

      <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.65, margin: '4px 0 28px' }}>
        Agencies are managed in <strong style={{ color: C.text }}>Travelgenix Control</strong>,
        the single source of truth for clients. Luna Travel stores no agency records — it reads
        the clients entitled to the Luna Travel product. To bring a new agency on board:
      </p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {STEPS.map((s, i) => (
          <li
            key={i}
            style={{
              display: 'flex', gap: 14,
              backgroundColor: C.bgElevated,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '16px 18px',
            }}
          >
            <span style={{
              height: 26, width: 26, borderRadius: 8, flexShrink: 0,
              backgroundColor: C.bgTertiary, color: C.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
            }}>{i + 1}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <a
        href="https://id.travelify.io/admin"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginTop: 24, padding: '0 16px', height: 42, borderRadius: 8,
          backgroundColor: C.primary, color: '#fff', textDecoration: 'none',
          fontSize: 14, fontWeight: 500,
        }}
      >
        Open Travelgenix Control
        <ExternalLink style={{ height: 15, width: 15 }} strokeWidth={1.75} />
      </a>
    </div>
  );
}
