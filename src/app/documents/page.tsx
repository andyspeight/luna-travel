'use client';

import { useBooking } from '@/lib/booking-context';
import { fileSize } from '@/lib/format';
import { IconDoc, IconChevR } from '@/components/icons';

export default function DocumentsPage() {
  const { booking } = useBooking();

  return (
    <main className="px-5 pt-4">
      <header className="py-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Documents</h1>
        <p className="text-sm text-ink-2 mt-1">
          Always available offline · {booking.documents.length} items
        </p>
      </header>

      <section className="mt-4 space-y-2.5">
        {booking.documents.map((d) => (
          <article
            key={d.id}
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-line-light cursor-pointer hover:shadow-sm transition-shadow"
          >
            <div className="w-12 h-15 rounded-lg bg-gradient-to-br from-navy to-teal-dark text-white flex items-center justify-center shadow-md flex-shrink-0">
              <IconDoc size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink truncate">{d.name}</div>
              <div className="text-[11px] text-ink-3 mt-0.5">
                PDF · {fileSize(d.sizeBytes)}
              </div>
            </div>
            <div className="text-ink-3">
              <IconChevR size={18} />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
