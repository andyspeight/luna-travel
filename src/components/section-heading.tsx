'use client';

import Link from 'next/link';

interface SectionHeadingProps {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
}

export function SectionHeading({ title, seeAllHref, seeAllLabel = 'See all' }: SectionHeadingProps) {
  return (
    <div className="px-1 pb-2 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-ink tracking-tight">{title}</h2>
      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="text-xs font-medium text-teal-dark dark:text-teal-light hover:underline"
        >
          {seeAllLabel}
        </Link>
      )}
    </div>
  );
}
