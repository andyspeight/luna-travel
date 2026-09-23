import { describe, it, expect } from 'vitest';
import { orderToBooking, type TrimmedOrder } from '@/lib/order-to-booking';
import { matchLocationSlug } from '@/lib/location-match';

/**
 * A hotel's own photographs, from the order Control returns.
 *
 * Control has always sent accommodation.media (up to twelve, sanitised). The
 * mapper read media for tickets, transfers and car hire but not for hotels, so
 * every hotel page fell back to a country photo — the Amalfi coast for a hotel
 * in Rome (Villa Glori, WCS96420, 23 Sep 2026).
 */

const order = (media?: Array<{ url?: string | null; type?: string | null }>): TrimmedOrder => ({
  id: 1,
  currency: 'GBP',
  items: [
    {
      id: 7,
      product: 'Accommodation',
      startDate: '2027-02-12T00:00:00',
      accommodation: {
        name: 'Villa Glori Hotel',
        rating: 4,
        location: { city: 'Rome', country: 'Italy' },
        units: [{ name: 'Double room', checkin: '2027-02-12T00:00:00', nights: 3 }],
        media,
      },
    },
  ],
  summary: { earliestStart: '2027-02-12T00:00:00', latestEnd: '2027-02-15' },
});

describe('hotel photos', () => {
  it('come through from Travelify', () => {
    const b = orderToBooking(order([{ url: 'https://img.example/lobby.jpg' }, { url: 'https://img.example/room.jpg' }]), null, 'WCS96420');
    expect(b?.hotels[0].photos).toEqual(['https://img.example/lobby.jpg', 'https://img.example/room.jpg']);
  });

  it('leave out what is not a picture of the hotel', () => {
    const b = orderToBooking(
      order([
        { url: 'https://img.example/tour.mp4', type: 'Video' },
        { url: 'https://img.example/floor.png', type: 'FloorPlan' },
        { url: 'https://img.example/pool.jpg', type: 'Image' },
      ]),
      null,
      'WCS96420',
    );
    expect(b?.hotels[0].photos).toEqual(['https://img.example/pool.jpg']);
  });

  it('are simply absent when the supplier sent none', () => {
    expect(orderToBooking(order(), null, 'WCS96420')?.hotels[0].photos).toBeUndefined();
    expect(orderToBooking(order([{ url: '' }, { url: null }]), null, 'WCS96420')?.hotels[0].photos).toBeUndefined();
  });

  // Without a photo of its own, the hotel page falls back to its city, which
  // is found from the hotel's own address.
  it('know which city a Rome hotel is in, for the fallback photo', () => {
    expect(matchLocationSlug('IT', ['Rome'])).toBe('rome');
  });
});
