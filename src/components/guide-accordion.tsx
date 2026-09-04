'use client';

/**
 * Accordion list for agency-authored guide pages (Before you travel,
 * Itinerary). Plain-text bodies with preserved line breaks — content is
 * typed by agents in the portal, never HTML.
 */

import { useState } from 'react';
import type { AccordionItem } from '@/lib/trip-content';
import { IconChevR } from '@/components/icons';

export function GuideAccordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <li key={item.id} className="rounded-2xl bg-surface border border-line-light overflow-hidden">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3 p-4 text-left tap"
            >
              <span className="flex-1 text-[15px] font-semibold text-ink leading-snug">
                {item.title}
              </span>
              <span
                className="flex-none text-ink-3 transition-transform duration-200"
                style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
              >
                <IconChevR size={16} />
              </span>
            </button>
            {isOpen && item.body && (
              <div className="px-4 pb-4 -mt-1 text-sm text-ink-2 leading-relaxed whitespace-pre-line">
                {item.body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
