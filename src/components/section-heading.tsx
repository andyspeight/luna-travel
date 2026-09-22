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
    <div className="px-1 pb-2 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-ink tracking-tight">{title}</h2>
      {seeAllHref && (
        /* The label stays small; the target does not. It measured 40x16. */
        <Link
          href={seeAllHref}
          className="-my-3 -mr-2 inline-flex min-h-[44px] items-center px-2 text-xs font-medium text-teal-dark dark:text-teal-light hover:underline"
        >
          {label}
        </Link>
      )}
    </div>
  );
}
