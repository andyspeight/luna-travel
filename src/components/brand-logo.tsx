'use client';

/**
 * An agency's logo, whole, on something it can be read against.
 *
 * Height is fixed by the screen; the width follows the logo's own shape up to
 * `maxWidth`, so a wide logo is shown wide instead of shrunk into a square.
 * Behind it goes whatever lib/logo-look says its tone needs on this surface:
 * nothing, a white plate, or a plate in the agency's own colour (made dark
 * enough for light lettering if it is not already).
 *
 * `surface="theme"` is for screens that are light or dark with the phone's
 * setting: the plate is chosen for each and switched with the theme.
 *
 * Calls `onFail` if the image will not load, so the screen can fall back to
 * its monogram rather than show a broken image.
 */

import { useState } from 'react';
import { plateFor, type LogoMeta, type Plate, type Surface } from '@/lib/logo-look';
import { parseHex, contrast, mix, toHex } from '@/lib/contrast';

/** The agency's colour, darkened until white lettering reads on it. */
function darkPlateColour(primary?: string): string {
  const white = { r: 255, g: 255, b: 255 };
  let c = parseHex(primary || '') ?? { r: 15, g: 23, b: 42 };
  for (let i = 0; i < 12 && contrast(white, c) < 4.5; i++) c = mix(c, 0, 0.2);
  return toHex(c);
}

function plateStyle(plate: Plate, dark: string): React.CSSProperties {
  if (plate === 'white') return { background: '#ffffff', boxShadow: '0 1px 3px rgba(15,23,42,0.18)' };
  if (plate === 'dark') return { background: dark, boxShadow: '0 1px 3px rgba(15,23,42,0.18)' };
  return {};
}

export function BrandLogo({
  src,
  meta,
  primary,
  surface,
  height,
  maxWidth,
  alt = '',
  onFail,
  className = '',
}: {
  src: string;
  meta?: LogoMeta | null;
  primary?: string;
  surface: Surface | 'theme';
  height: number;
  maxWidth: number;
  alt?: string;
  onFail?: () => void;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;

  const tone = meta?.tone;
  const dark = darkPlateColour(primary);
  const boxed = tone === 'boxed';
  const padY = Math.round(height * 0.16);
  const padX = Math.round(height * 0.28);
  const radius = Math.round(height * (boxed ? 0.14 : 0.24));

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => {
        setBroken(true);
        onFail?.();
      }}
      style={{ height, width: 'auto', maxWidth, objectFit: 'contain', display: 'block', borderRadius: boxed ? radius : 0 }}
    />
  );

  // One plate for a fixed surface.
  if (surface !== 'theme') {
    const plate = plateFor(tone, surface);
    return (
      <span
        data-logo-plate={plate}
        className={`inline-flex items-center justify-center flex-none ${className}`}
        style={{ ...plateStyle(plate, dark), padding: plate === 'none' ? 0 : `${padY}px ${padX}px`, borderRadius: radius }}
      >
        {img}
      </span>
    );
  }

  // Light and dark themes can each need a different plate. Written out in
  // full because Tailwind only builds classes it can read in the source.
  const THEME: Record<string, string> = {
    // Light lettering: a plate in the light theme, bare on the dark one.
    'dark|none':
      'bg-[var(--logo-plate)] shadow-sm px-[var(--logo-px)] py-[var(--logo-py)] dark:bg-transparent dark:shadow-none dark:p-0',
    // Dark or mixed lettering: bare in the light theme, a white plate at night.
    'none|white': 'dark:bg-white dark:shadow-sm dark:px-[var(--logo-px)] dark:py-[var(--logo-py)]',
    'none|none': '',
  };
  const key = `${plateFor(tone, 'light')}|${plateFor(tone, 'dark')}`;
  return (
    <span
      data-logo-plate={key}
      className={`inline-flex items-center justify-center flex-none ${THEME[key] ?? ''} ${className}`}
      style={{ ['--logo-plate' as string]: dark, ['--logo-px' as string]: `${padX}px`, ['--logo-py' as string]: `${padY}px`, borderRadius: radius }}
    >
      {img}
    </span>
  );
}
