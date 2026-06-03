'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/locale-context';

interface SectionHeadingProps {
  title: string;
  seeAllHref?: string;
  seeAllLabel?: string;
}

export function SectionHeading({ title, seeAllHref, seeAllLabel }: SectionHeadingProps) {
  const { t } = useI18n();
  const label = seeAllLabel ?? t('common.seeAll');
  return (
    <div className="px-1 pb-2 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-ink tracking-tight">{title}</h2>
      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="text-xs font-medium text-teal-dark dark:text-teal-light hover:underline"
        >
          {label}
        </Link>
      )}
    </div>
  );
}
