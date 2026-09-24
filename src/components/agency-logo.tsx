'use client';

import { useState } from 'react';
import type { Agency } from '@/types/booking';
import { appNameOf, initialOf } from '@/lib/app-name';
import { IconPlane } from '@/components/icons';
import { BrandLogo } from '@/components/brand-logo';
import type { Surface } from '@/lib/logo-look';

/**
 * The agency's logo, or its monogram when it has none (or it will not load).
 *
 * The logo is shown whole, at its own shape, on whatever its tone needs on
 * this surface (components/brand-logo). It used to be forced into a white
 * square the size of the monogram: a wide logo became a sliver and white
 * lettering disappeared (24 Sep 2026).
 *
 * `size` is the monogram's size and the height the logo is fitted to.
 */
export function AgencyLogo({
  agency,
  size = 36,
  surface = 'theme',
  maxWidth,
  className = '',
}: {
  agency: Agency;
  size?: number;
  surface?: Surface | 'theme';
  maxWidth?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const label = appNameOf(agency);
  const radius = Math.round(size * 0.28);

  if (agency.logoUrl && !broken) {
    return (
      <BrandLogo
        src={agency.logoUrl}
        meta={agency.logoMeta}
        primary={agency.brandPrimaryColour}
        surface={surface}
        height={Math.round(size * 0.72)}
        maxWidth={maxWidth ?? size * 5}
        alt={label}
        onFail={() => setBroken(true)}
        className={className}
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
