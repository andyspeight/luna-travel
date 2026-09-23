/**
 * The picture for each day of the storyboard: a picture of the trip.
 *
 * Every day used to get the country's photograph, so a four-day Rome break
 * was four copies of the Amalfi coast (WCS96420, 23 Sep 2026: "you are just
 * showing images of Italy. The images should be all of the trip"). Now:
 *
 *   - the day you arrive shows where you have arrived: the city's photo;
 *   - every other day at a hotel shows the hotel itself, a different one of
 *     its own photos each day, so the story moves on as the stay does;
 *   - a day between places keeps the country of the flight, as before.
 *
 * Each day is a list, best first, for HeroPhoto: a photo that is missing or
 * fails falls through to the next, the city and then the country, and never
 * to nothing.
 *
 * Pure: the same day keys (UTC) the storyboard and the itinerary group by.
 */

import type { Booking, Hotel } from '@/types/booking';
import { destinationHero } from '@/lib/hero';
import { matchLocationSlug } from '@/lib/location-match';

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** The hotel the traveller is resident in on a given day (check-in..check-out inclusive). */
export function hotelForDay(booking: Booking, day: string): Hotel | undefined {
  return booking.hotels.find((h) => dayKey(h.checkIn) <= day && day <= dayKey(h.checkOut));
}

const DAY_MS = 86_400_000;
const daysBetween = (fromDay: string, toDay: string) =>
  Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS);

const unique = (list: Array<string | undefined>) =>
  list.filter((u, i, all): u is string => !!u && all.indexOf(u) === i);

/**
 * The photos for a day spent at `hotel`, best first.
 *
 * `countryFallback` is the country to show if nothing more specific exists.
 */
export function hotelDayPhotos(hotel: Hotel, day: string, countryFallback?: string): string[] {
  const cc = hotel.countryCode || countryFallback || '';
  const hero = cc ? destinationHero(cc, matchLocationSlug(cc, [hotel.city, hotel.resort])) : null;
  const city = hero?.imageLocation;
  const own = (hotel.photos ?? []).filter(Boolean);
  const nth = daysBetween(dayKey(hotel.checkIn), day);

  // Arrival: where you have arrived, then the hotel, then the country.
  if (nth <= 0 || !own.length) return unique([city, own[0], hero?.image]);

  // Every other day: the next of the hotel's own photos, round again if the
  // stay is longer than the gallery.
  return unique([own[(nth - 1) % own.length], city, hero?.image]);
}

/** The photos for a travel day with no hotel: the country the day is about. */
export function countryDayPhotos(countryCode: string | undefined): string[] {
  return countryCode ? unique([destinationHero(countryCode).image]) : [];
}
