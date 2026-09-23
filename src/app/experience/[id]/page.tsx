'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { ActionButton } from '@/components/action-button';
import { PageEnter } from '@/components/page-enter';
import { MapSheet } from '@/components/map-sheet';
import { PhotoGallery } from '@/components/photo-gallery';
import {
  IconCompass,
  IconCar,
  IconClock,
  IconInfo,
  IconTicket,
  IconNavigate,
  IconPin,
} from '@/components/icons';
import { ParkPanel, NearbyParks } from '@/components/park-panel';
import { findExperience, EXPERIENCE_LABELS } from '@/lib/booking-helpers';
import { formatDate, formatTime } from '@/lib/format';
import { usePlace } from '@/lib/use-place';
import { matchTicketsToParks } from '@/lib/park-match';
import type { ExperienceKind } from '@/types/booking';
import type { ParkRecord } from '@/types/destination-content';

// The park list is chain-wide, so without this an airport transfer or a car
// hire in Orlando would carry a "theme parks in the area" block — and, worse,
// a full park guide claimed as theirs. Both claims are gated on these kinds.
// Only a genuine attraction booking earns a park guide. Travelify Extras — a dining
// plan, resort car parking, a fast-track pass — all map to kind 'other', and they
// carry the park's NAME, so including 'other' here handed "Walt Disney World Dining
// Plan" a full park guide with Disney's height restrictions on it. attractionKind()
// only ever returns 'excursion' or 'activity' for a real ticket.
const TICKET_KINDS = new Set<ExperienceKind>(['excursion', 'activity']);

export default function ExperienceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { booking } = useBooking();
  const [showMap, setShowMap] = useState(false);
  const exp = findExperience(booking, params.id);
  const { place } = usePlace(booking);

  // A ticket only gets a park guide when the matcher was confident about THIS
  // experience; anything else stays in `nearby` and is never called theirs.
  //
  // The kind gate is load-bearing, not defensive. order-to-booking.ts builds
  // transfer titles as `Transfer to ${dropoff}`, so a real Mears airport
  // transfer becomes "Transfer to Universal Orlando Resort" carrying the
  // PICKUP coordinates (the airport) — it matches Universal on name, and the
  // coordinate veto cannot save us because the airport is inside the 40 km
  // window. Same shape for "Disney Magical Express", "Universal Orlando Resort
  // car park" and "Walt Disney World Dining Plan". A park guide asserts "this
  // is your park" and prints height restrictions, so a transfer, a car hire, a
  // lounge or a parking add-on must never be given one — exactly what
  // park-match.ts's header says it exists to prevent.
  const { park, nearby } = useMemo((): { park: ParkRecord | null; nearby: ParkRecord[] } => {
    if (!exp || !TICKET_KINDS.has(exp.kind)) return { park: null, nearby: [] };
    const { matched, nearby: rest } = matchTicketsToParks(
      [{ id: exp.id, title: exp.title, lat: exp.lat, lng: exp.lng }],
      place?.parks ?? [],
    );
    const mine = matched.filter((m) => m.experienceId === exp.id);
    return { park: mine.length === 1 ? mine[0].park : null, nearby: rest };
  }, [exp, place]);

  if (!exp) {
    return (
      <>
        <NavBar title="Experience" backLabel="Back" />
        <main className="px-5 pt-12 text-center">
          <p className="text-ink-2">Item not found.</p>
          <button onClick={() => router.replace('/itinerary')} className="mt-4 text-teal-dark hover:underline text-sm">
            Back to itinerary
          </button>
        </main>
      </>
    );
  }

  const meta = experienceMeta(exp.kind);
  const hero = exp.photos?.[0];
  const galleryPhotos = (exp.photos ?? []).slice(1);

  return (
    <PageEnter>
      <main className="pb-6">
        <section
          className="relative pt-2 px-5 pb-8 text-white"
          style={hero ? { backgroundImage: `url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: meta.gradient }}
        >
          <div aria-hidden className="absolute inset-0" style={{ background: hero ? 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.7) 100%)' : 'radial-gradient(ellipse at 85% 10%, rgba(255,255,255,0.18), transparent 50%)' }} />
          <div className="relative">
            <NavBar title=" " backLabel="Trip" variant="dark" />
            <div className="mt-3 mb-1 inline-flex items-center gap-2 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
              {meta.icon}
              {EXPERIENCE_LABELS[exp.kind]}
            </div>
            <h1 className="font-serif text-[28px] leading-tight mt-2">{exp.title}</h1>
            <p className="text-sm opacity-90 mt-1">
              {formatDate(exp.startDate, { weekday: 'long', day: 'numeric', month: 'long' })}
              {exp.time ? ` · ${exp.time}` : exp.startDate.includes('T') ? ` · ${formatTime(exp.startDate)}` : ''}
              {exp.location ? ` · ${exp.location}` : ''}
            </p>
          </div>
        </section>

        <div className="px-5 pt-4 space-y-3">
          {galleryPhotos.length > 0 && <PhotoGallery photos={galleryPhotos} className="pt-1" />}

          <Panel title="Details" icon={<IconInfo size={14} />}>
            <ul className="divide-y divide-line-light text-sm">
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2 inline-flex items-center gap-1.5"><IconClock size={13} /> Starts</span>
                <span className="text-ink font-medium">{formatDate(exp.startDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </li>
              {exp.endDate && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2 inline-flex items-center gap-1.5"><IconClock size={13} /> Ends</span>
                  <span className="text-ink font-medium">{formatDate(exp.endDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </li>
              )}
              {exp.location && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2 inline-flex items-center gap-1.5"><IconPin size={13} /> Location</span>
                  <span className="text-ink font-medium text-right">{exp.location}</span>
                </li>
              )}
              {exp.supplier && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2 inline-flex items-center gap-1.5"><IconInfo size={13} /> Supplier</span>
                  <span className="text-ink font-medium text-right">{exp.supplier}</span>
                </li>
              )}
            </ul>
          </Panel>

          {park && <ParkPanel park={park} href={`/park/${park.slug}`} image={hero} />}

          {/* NearbyParks is handed the resolved place because "in the area" is a
              spatial claim the chain-wide park join cannot support on its own —
              it filters by real distance from place.coords and renders nothing
              when it has no origin it can stand behind. */}
          {!park && nearby.length > 0 && TICKET_KINDS.has(exp.kind) && (
            <NearbyParks parks={nearby} place={place} />
          )}

          {exp.notes && (
            <Panel title="Notes" icon={<IconInfo size={14} />}>
              <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">{exp.notes}</p>
            </Panel>
          )}

          <Panel title="Booking" icon={<IconTicket size={14} />}>
            <ul className="divide-y divide-line-light text-sm">
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2">Booking reference</span>
                <span className="text-ink font-medium tabular">{exp.reference || booking.reference}</span>
              </li>
            </ul>
          </Panel>

          {exp.location && (
            <ActionButton icon={<IconNavigate size={18} />} onClick={() => setShowMap(true)}>
              Find {exp.title}
            </ActionButton>
          )}
        </div>
      </main>

      {showMap && exp.location && (
        <MapSheet
          title={exp.title}
          subtitle={exp.location}
          query={`${exp.title}, ${exp.location}`}
          onClose={() => setShowMap(false)}
        />
      )}
    </PageEnter>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line-light rounded-2xl p-4">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function experienceMeta(kind: ExperienceKind) {
  switch (kind) {
    case 'car-hire':
    case 'transfer':
      return { icon: <IconCar size={14} />, gradient: 'linear-gradient(135deg, #0F766E 0%, #0EA5E9 100%)' };
    case 'excursion':
    case 'activity':
      return { icon: <IconCompass size={14} />, gradient: 'linear-gradient(135deg, #1B2B5B 0%, #0096B7 100%)' };
    default:
      return { icon: <IconCompass size={14} />, gradient: 'linear-gradient(135deg, #475569 0%, #94A3B8 100%)' };
  }
}
