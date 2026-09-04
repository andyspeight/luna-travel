'use client';

/**
 * Find your way around — agency-curated places on a real street map
 * (Leaflet + OpenStreetMap), with a tappable list underneath. Tapping a card
 * flies the map to that pin; every place gets a keyless Google Maps
 * directions deep link for actual navigation.
 */

import { useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { useI18n } from '@/lib/locale-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { PlacesMap } from '@/components/places-map';
import { useTripContent } from '@/lib/use-trip-content';
import { IconPin, IconChevR } from '@/components/icons';

export default function FindYourWayPage() {
  const { booking } = useBooking();
  const { t } = useI18n();
  const { pages, loading } = useTripContent();
  const places = pages['find-your-way'];
  const [focusId, setFocusId] = useState<string | null>(null);

  return (
    <>
      <NavBar title={t('guide.fyw')} backLabel={t('tab.trip')} />
      <PageEnter>
        <main className="px-5 pt-2 pb-8">
          <header className="py-3">
            <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">
              {t('guide.fyw')}
            </h1>
            <p className="text-sm text-ink-2 mt-1.5">
              {t('guide.from', { agency: booking.agency.name })}
            </p>
          </header>

          {places.length > 0 ? (
            <>
              <PlacesMap places={places} focusId={focusId} />

              <ul className="mt-4 space-y-2.5">
                {places.map((p) => (
                  <li key={p.id} className="rounded-2xl bg-surface border border-line-light overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFocusId(p.id)}
                      className="w-full flex items-start gap-3 p-4 text-left tap"
                    >
                      <span className="flex-none w-9 h-9 rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center mt-0.5">
                        <IconPin size={16} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-ink leading-snug">{p.name}</span>
                          <span className="flex-none text-[10px] uppercase tracking-[0.12em] text-ink-3">
                            {t(`guide.cat.${p.category}`)}
                          </span>
                        </span>
                        {p.description && (
                          <span className="block text-sm text-ink-2 mt-1 leading-relaxed whitespace-pre-line">
                            {p.description}
                          </span>
                        )}
                      </span>
                    </button>
                    <div className="px-4 pb-3 -mt-1 pl-16">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] font-semibold text-teal-dark dark:text-teal-light"
                      >
                        {t('guide.directions')}
                        <IconChevR size={13} />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-[11px] text-ink-3 leading-relaxed">
                {t('guide.mapAttrib')}
              </p>
            </>
          ) : (
            <div className="p-6 rounded-2xl bg-surface border border-line-light text-center text-sm text-ink-2">
              {loading ? '…' : t('guide.empty')}
            </div>
          )}
        </main>
      </PageEnter>
    </>
  );
}
