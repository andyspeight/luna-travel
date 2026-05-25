/**
 * Hero destination roster.
 *
 * Generated 24 May 2026 from the Destination Content base
 * (appuZdlMJ7HKUt6qS / Countries tblsxbqbyhTDoWhbo) — 100 countries.
 *
 * Each destination is keyed by ISO-3166-1 alpha-2 country code, which is the
 * same key the PWA's hero system uses (src/lib/hero.ts: MV, ES, AE, GR ...).
 * Storing the code here lets the admin grid list every destination and the
 * app look up the matching hero image by code.
 *
 * This is a static snapshot, not a live Airtable read — deliberately. The
 * country roster changes rarely; the *images* are dynamic (Supabase Storage).
 * To regenerate after countries are added: re-run the Airtable pull and
 * replace this array. Andy: just say "regenerate the hero roster".
 *
 * `code` is the storage + lookup key. `name` is the display label.
 * Codes are uppercase ISO-2. A handful are not strict countries (e.g. Hong
 * Kong = HK, which is correct ISO-2; Tobago shares TT with Trinidad).
 */

export interface HeroDestination {
  /** ISO-3166-1 alpha-2, uppercase. The storage + app lookup key. */
  code: string;
  /** Display name as it appears in the Destination Content base. */
  name: string;
}

export const HERO_DESTINATIONS: HeroDestination[] = [
  { code: 'AL', name: 'Albania' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AG', name: 'Antigua' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AW', name: 'Aruba' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BM', name: 'Bermuda' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'VG', name: 'British Virgin Islands' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CA', name: 'Canada' },
  { code: 'CV', name: 'Cape Verde' },
  { code: 'KY', name: 'Cayman Islands' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CW', name: 'Curacao' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'LA', name: 'Laos' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'MT', name: 'Malta' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PA', name: 'Panama' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'KN', name: 'St Kitts & Nevis' },
  { code: 'LC', name: 'St Lucia' },
  { code: 'VC', name: 'St Vincent & the Grenadines' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'GM', name: 'The Gambia' },
  { code: 'TT', name: 'Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Turkey' },
  { code: 'TC', name: 'Turks & Caicos' },
  { code: 'AE', name: 'UAE' },
];

/** Quick lookup: ISO-2 code → display name. */
export const HERO_DESTINATION_BY_CODE: Record<string, string> =
  HERO_DESTINATIONS.reduce((acc, d) => {
    acc[d.code] = d.name;
    return acc;
  }, {} as Record<string, string>);
