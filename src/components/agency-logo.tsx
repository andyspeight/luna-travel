'use client';

import { useState } from 'react';
import type { Agency } from '@/types/booking';
import { appNameOf, initialOf } from '@/lib/app-name';
import { IconPlane } from '@/components/icons';

/**
 * Agency logo chip with a graceful fallback.
 *
 * Renders the agency's white-label logo on a white chip (so any logo colour
 * reads on any surface). If there's no logo, or it fails to load, falls back to
 * a gradient monogram from the agency/app name — so the header never shows a
 * broken image.
 */
export function AgencyLogo({
  agency,
  size = 36,
  className = '',
}: {
  agency: Agency;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const label = appNameOf(agency);
  const radius = Math.round(size * 0.28);

  if (agency.logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={agency.logoUrl}
        alt={label}
        onError={() => setBroken(true)}
        className={`object-contain bg-white shadow-sm ${className}`}
        style={{ width: size, height: size, borderRadius: radius, padding: Math.round(size * 0.12) }}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`bg-gradient-to-br from-navy to-teal text-white font-bold flex items-center justify-center shadow-sm ${className}`}
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.42) }}
    >
      {initialOf(label) || <IconPlane size={Math.round(size * 0.45)} />}
    </div>
  );
}
