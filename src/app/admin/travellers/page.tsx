'use client';

import React from 'react';

const C = {
  bg: '#F8FAFC',
  bgElevated: '#FFFFFF',
  bgTertiary: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
};

export default function StubPage() {
  return (
    <div style={{ padding: '32px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 4 }}>
          Travelgenix admin
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: C.text, margin: 0, letterSpacing: '-0.01em' }}>
          Travellers
        </h1>
      </div>
      <div style={{
        borderRadius: 12,
        backgroundColor: C.bgElevated,
        border: `1px dashed ${C.border}`,
        padding: '64px 32px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>
          On the build list
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary, maxWidth: 480, margin: '0 auto', lineHeight: 1.5 }}>
          Per-agency traveller list with install status, device management, push token health and trip lifecycle filters. Wired to Luna Work as the source of truth.
        </div>
      </div>
    </div>
  );
}
