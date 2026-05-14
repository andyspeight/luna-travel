'use client';

import { useBooking } from '@/lib/booking-context';
import { useTheme } from '@/lib/theme-context';
import { initials } from '@/lib/format';
import { IconSun, IconMoon } from '@/components/icons';

export default function MePage() {
  const { booking } = useBooking();
  const { theme, toggle } = useTheme();
  const lead = booking.travellers.find((t) => t.isLead) ?? booking.travellers[0];

  return (
    <main className="px-5 pt-4">
      <header className="py-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Me</h1>
      </header>

      <section className="mt-4 p-4 rounded-2xl bg-surface border border-line-light flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-navy to-teal-dark text-white font-bold text-lg flex items-center justify-center">
          {initials(lead.firstName, lead.lastName)}
        </div>
        <div>
          <div className="text-base font-semibold text-ink">
            {lead.title} {lead.firstName} {lead.lastName}
          </div>
          <div className="text-xs text-ink-2">{booking.leadEmail}</div>
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-surface border border-line-light overflow-hidden">
        <button
          type="button"
          onClick={() => toggle()}
          className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors text-left"
        >
          <span className="text-teal-dark dark:text-teal-light">
            {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium text-ink">Appearance</div>
            <div className="text-xs text-ink-2 capitalize">{theme} mode</div>
          </div>
        </button>
      </section>

      <section className="mt-3 p-4 rounded-2xl bg-surface border border-line-light">
        <div className="text-xs uppercase tracking-wide text-ink-3 font-semibold mb-2">
          Your agent
        </div>
        <div className="text-sm font-semibold text-ink">{booking.agency.name}</div>
        <div className="text-xs text-ink-2 mt-1">
          {booking.agency.phone} · {booking.agency.email}
        </div>
        {booking.agency.emergencyPhone && (
          <div className="text-xs text-ink-2">
            24h emergency · {booking.agency.emergencyPhone}
          </div>
        )}
      </section>
    </main>
  );
}
