'use client';

import { useBooking } from '@/lib/booking-context';
import { useI18n } from '@/lib/locale-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { TripMap } from '@/components/trip-map';
import { buildTripMap } from '@/lib/trip-map';
import { formatKm } from '@/lib/geo';
import { IconPlane, IconBed, IconRoute } from '@/components/icons';

export default function MapPage() {
  const { booking } = useBooking();
  const { t } = useI18n();
  const model = buildTripMap(booking);

  const hasGeometry = model.nodes.length > 0;

  return (
    <>
      <NavBar title={t('map.title')} backLabel={t('tab.trip')} />
      <PageEnter>
        <main className="px-5 pt-2 pb-8">
          <header className="py-3">
            <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">
              {booking.destinationLabel}
            </h1>
            <p className="text-sm text-ink-2 mt-1.5">
              {t('map.subtitle')}
            </p>
          </header>

          {hasGeometry ? (
            <>
              {/* Summary strip */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Stat
                  icon={<IconPlane size={16} />}
                  value={String(model.airportCount)}
                  label={model.airportCount === 1 ? t('map.airport') : t('map.airports')}
                />
                <Stat
                  icon={<IconBed size={16} />}
                  value={String(model.hotelCount)}
                  label={model.hotelCount === 1 ? t('map.hotel') : t('map.hotels')}
                />
                <Stat
                  icon={<IconRoute size={16} />}
                  value={model.totalFlightKm > 0 ? formatKm(model.totalFlightKm) : '—'}
                  label={t('map.flown')}
                />
              </div>

              <TripMap model={model} />

              <p className="mt-4 text-[11px] text-ink-3 leading-relaxed">
                {t('map.attrib')}
              </p>
            </>
          ) : (
            <div className="mt-6 p-6 rounded-2xl bg-surface border border-line-light text-center">
              <p className="text-sm text-ink-2">
                {t('map.noLocations')}
              </p>
            </div>
          )}
        </main>
      </PageEnter>
    </>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-surface border border-line-light rounded-2xl py-3 px-2 text-center">
      <div className="w-7 h-7 mx-auto mb-1 rounded-lg bg-teal/10 text-navy dark:text-teal-light flex items-center justify-center">
        {icon}
      </div>
      <div className="text-[15px] font-bold text-ink leading-none tabular">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-3 mt-1">{label}</div>
    </div>
  );
}
