'use client';

import { ReactNode } from 'react';

/**
 * Subtle entrance animation for pages and sections.
 * Fades in and slides up 8px on mount. Respects prefers-reduced-motion
 * (handled in globals.css — animation duration drops to 0.01ms).
 *
 * Use as the outermost wrapper of a page's main content.
 */
export function PageEnter({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={`animate-slide-up ${className}`}
      style={delay ? { animationDelay: `${delay}ms`, animationFillMode: 'both' } : undefined}
    >
      {children}
    </div>
  );
}
