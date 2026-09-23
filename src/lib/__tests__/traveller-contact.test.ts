import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The contact details a traveller sees on Get help came only from the Control
 * record, whose email is often not the one an agency wants travellers writing
 * to (23 Sep 2026). An agency can now set its own; each one left empty still
 * shows the record's.
 */

let stored: Record<string, unknown> | null = null;
let written: Record<string, unknown> | null = null;
vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: stored }) }) }),
      upsert: async (row: Record<string, unknown>) => {
        written = row;
        return { error: null };
      },
    }),
  }),
}));

import { isPhone } from '@/lib/contact-check';
import { getAgencySettings, setAgencySettings, applySupportSettings } from '@/lib/agency-settings';
import type { Agency } from '@/types/booking';

beforeEach(() => {
  stored = null;
  written = null;
});

const controlAgency = (): Agency => ({
  name: 'Your Travel Co',
  email: 'accounts@yourtravel.co',
  phone: '0161 000 0000',
  emergencyPhone: '07700 900000',
});

describe('isPhone', () => {
  it('takes the ways people actually write a phone number', () => {
    for (const n of ['01234 567890', '+44 7700 900123', '(0161) 496-0000', '+1.212.555.0100', '999999']) {
      expect(isPhone(n), n).toBe(true);
    }
  });

  it('refuses what nobody can dial', () => {
    for (const n of ['', 'call us', '12345', '+44 7700 900123 ext 4', '1'.repeat(16), 'tel:01234567890', '<b>0123456</b>']) {
      expect(isPhone(n), n).toBe(false);
    }
  });
});

describe('what a traveller sees on Get help', () => {
  it('is what the agency set, where it set something', () => {
    const agency = controlAgency();
    applySupportSettings(agency, { travellerEmail: 'hello@yourtravel.co', travellerPhone: '01234 567890' });
    expect(agency.email).toBe('hello@yourtravel.co');
    expect(agency.phone).toBe('01234 567890');
    // Not set, so still the record's.
    expect(agency.emergencyPhone).toBe('07700 900000');
  });

  it('is the Control record’s when the agency has set nothing', () => {
    const agency = controlAgency();
    applySupportSettings(agency, {});
    expect(agency).toEqual(controlAgency());
  });
});

describe('saving and loading them', () => {
  it('stores each one, and clears what was emptied', async () => {
    await setAgencySettings('recA', { travellerEmail: ' hello@yourtravel.co ', travellerPhone: '01234 567890' });
    expect(written).toMatchObject({
      traveller_email: 'hello@yourtravel.co',
      traveller_phone: '01234 567890',
      traveller_emergency_phone: null,
    });
  });

  it('never stores a number nobody can dial', async () => {
    await setAgencySettings('recA', { travellerPhone: 'ring the office' });
    expect(written?.traveller_phone).toBeNull();
  });

  it('reads them back, and drops anything malformed that got into the table', async () => {
    stored = {
      agency_id: 'recA',
      traveller_email: 'hello@yourtravel.co',
      traveller_phone: 'not a number',
      traveller_emergency_phone: '+44 7700 900123',
    };
    const s = await getAgencySettings('recA');
    expect(s.travellerEmail).toBe('hello@yourtravel.co');
    expect(s.travellerPhone).toBeUndefined();
    expect(s.travellerEmergencyPhone).toBe('+44 7700 900123');
  });
});
