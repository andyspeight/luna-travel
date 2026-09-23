import { describe, it, expect } from 'vitest';
import { hotelDayPhotos, countryDayPhotos, hotelForDay } from '@/lib/storyboard-photos';
import type { Booking, Hotel } from '@/types/booking';

/**
 * WCS96420: four days in Rome at the Villa Glori, and the storyboard showed
 * the same photo of the Amalfi coast on all four (23 Sep 2026: "you are just
 * showing images of Italy. The images should be all of the trip").
 */

const BASE = 'https://iexryjynfaktfbvzlwlx.supabase.co/storage/v1/object/public/destination-heroes';
const ROME = `${BASE}/IT/rome/landscape.webp`;
const ITALY = `${BASE}/IT/landscape.webp`;

const villaGlori = (photos?: string[]): Hotel =>
  ({
    id: 'h1',
    name: 'Villa Glori Hotel',
    city: 'Rome',
    country: 'Italy',
    countryCode: 'IT',
    checkIn: '2027-02-12',
    checkOut: '2027-02-15',
    photos,
  }) as unknown as Hotel;

const GALLERY = ['https://img.example/villa-1.jpg', 'https://img.example/villa-2.jpg', 'https://img.example/villa-3.jpg'];
const DAYS = ['2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15'];

describe('the storyboard shows the trip, not the country', () => {
  it('opens on the city you arrive in', () => {
    expect(hotelDayPhotos(villaGlori(GALLERY), DAYS[0])[0]).toBe(ROME);
  });

  it('then shows the hotel itself, a different photo each day', () => {
    const firsts = DAYS.slice(1).map((d) => hotelDayPhotos(villaGlori(GALLERY), d)[0]);
    expect(firsts).toEqual(GALLERY);
  });

  it('never leads with the country photo while the trip has pictures of its own', () => {
    for (const d of DAYS) {
      expect(hotelDayPhotos(villaGlori(GALLERY), d)[0]).not.toBe(ITALY);
      expect(hotelDayPhotos(villaGlori(), d)[0]).not.toBe(ITALY);
    }
  });

  it('with no hotel photos, stays on the city', () => {
    for (const d of DAYS) expect(hotelDayPhotos(villaGlori(), d)[0]).toBe(ROME);
  });

  it('goes round the gallery again on a stay longer than it', () => {
    const long = { ...villaGlori(GALLERY.slice(0, 2)), checkOut: '2027-02-20' } as Hotel;
    const firsts = ['2027-02-13', '2027-02-14', '2027-02-15'].map((d) => hotelDayPhotos(long, d)[0]);
    expect(firsts).toEqual([GALLERY[0], GALLERY[1], GALLERY[0]]);
  });

  it('always has somewhere to fall back to, ending with the country', () => {
    for (const d of DAYS) {
      const list = hotelDayPhotos(villaGlori(GALLERY), d);
      expect(list[list.length - 1]).toBe(ITALY);
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('a day between places keeps the country of the flight', () => {
    expect(countryDayPhotos('GB')).toEqual([`${BASE}/GB/landscape.webp`]);
    expect(countryDayPhotos(undefined)).toEqual([]);
  });

  it('knows which hotel you are in, including the day you leave', () => {
    const booking = { hotels: [villaGlori()] } as unknown as Booking;
    expect(hotelForDay(booking, '2027-02-15')?.name).toBe('Villa Glori Hotel');
    expect(hotelForDay(booking, '2027-02-16')).toBeUndefined();
  });
});
