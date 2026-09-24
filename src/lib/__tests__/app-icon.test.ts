import { describe, it, expect } from 'vitest';
import {
  iconSpecFor,
  iconUrl,
  manifestUrl,
  parseIconQuery,
  isStoredIconUrl,
  isOwnIconUrl,
  iconInitial,
  buildManifest,
  shortNameOf,
} from '@/lib/app-icon';
import { brandingRow } from '@/lib/agency-branding';

/**
 * Every agency's travellers got the same "LT" icon and "Luna Travel" under it
 * (23 Sep 2026: "not everyone will want LT"). The icon is now the agency's
 * upload, or their app name's first letter on their colours.
 */

const STORE = 'https://abc123xyz.public.blob.vercel-storage.com';
const ICON = `${STORE}/agency-icons/recAAAAAAAAAAAAAA-1727100000000-icon-Xy12.png`;

const query = (url: string) => new URL(url, 'https://my-booking.co').searchParams;

describe('the icon an agency gets', () => {
  it('is their app name’s first letter on their own colours', () => {
    const spec = iconSpecFor({ appName: 'Sunseekers', brandPrimaryColour: '#0E7490', brandAccentColour: '#F59E0B' });
    expect(spec).toEqual({ initial: 'S', primary: '#0e7490', accent: '#f59e0b', imageUrl: undefined });
  });

  it('falls back to the agency name, then to the app’s own colours', () => {
    const spec = iconSpecFor({ name: 'Exclusively Travel' });
    expect(spec.initial).toBe('E');
    expect(spec.primary).toBe('#1b2b5b');
  });

  it('is their uploaded icon when they have one of ours', () => {
    expect(iconSpecFor({ name: 'X', iconUrl: ICON }).imageUrl).toBe(ICON);
    expect(iconSpecFor({ name: 'X', iconUrl: 'https://evil.example/agency-icons/a.png' }).imageUrl).toBeUndefined();
  });

  it('never draws a letter the font does not have', () => {
    expect(iconInitial('Évasion')).toBe('É');
    expect(iconInitial('7 Seas')).toBe('7');
    expect(iconInitial('東京トラベル')).toBe('');
    expect(iconInitial('')).toBe('');
  });
});

describe('icon and manifest URLs', () => {
  const spec = iconSpecFor({ appName: 'Sunseekers', brandPrimaryColour: '#0e7490', brandAccentColour: '#f59e0b', iconUrl: ICON });

  it('read back to exactly what was written', () => {
    const q = parseIconQuery(query(iconUrl(spec, 512, true)));
    expect(q).toEqual({ spec, size: 512, maskable: true, badge: false, name: '' });
    const m = parseIconQuery(query(manifestUrl(spec, 'Sunseekers')));
    expect(m?.size).toBeNull();
    expect(m?.name).toBe('Sunseekers');
  });

  it('refuse anything they would not have written', () => {
    const bad = [
      '/api/app/icon?s=64&p=0e7490&a=f59e0b',
      '/api/app/icon?s=192&p=red&a=f59e0b',
      '/api/app/icon?s=192&p=0e7490&a=f59e0b&l=AB',
      '/api/app/icon?s=192&p=0e7490&a=f59e0b&l=%3C',
      `/api/app/icon?s=192&p=0e7490&a=f59e0b&u=${encodeURIComponent('https://169.254.169.254/agency-icons/x.png')}`,
      `/api/app/icon?s=192&p=0e7490&a=f59e0b&u=${encodeURIComponent('http://abc.public.blob.vercel-storage.com/agency-icons/x.png')}`,
      `/api/app/icon?s=192&p=0e7490&a=f59e0b&u=${encodeURIComponent(`${STORE}/agency-logos/x.png`)}`,
    ];
    for (const u of bad) expect(parseIconQuery(query(u)), u).toBeNull();
  });
});

describe('whose icon it is', () => {
  it('is only ever fetched from our store’s icon folder', () => {
    expect(isStoredIconUrl(ICON)).toBe(true);
    expect(isStoredIconUrl(`${STORE}/agency-icons/../agency-logos/x.png`)).toBe(false);
    expect(isStoredIconUrl(`${STORE}:8443/agency-icons/x.png`)).toBe(false);
    expect(isStoredIconUrl(`https://user@abc.public.blob.vercel-storage.com/agency-icons/x.png`)).toBe(false);
    expect(isStoredIconUrl(`https://public.blob.vercel-storage.com.evil.example/agency-icons/x.png`)).toBe(false);
    expect(isStoredIconUrl(`${ICON}?x=1`)).toBe(false);
  });

  it('can only be saved into the agency’s own folder', () => {
    expect(isOwnIconUrl(ICON, 'recAAAAAAAAAAAAAA')).toBe(true);
    expect(isOwnIconUrl(ICON, 'recBBBBBBBBBBBBBB')).toBe(false);
    expect(isOwnIconUrl(ICON, '')).toBe(false);
  });

  it('is left alone by a save that knows nothing about it', () => {
    expect(brandingRow('rec1', { iconUrl: ICON }).icon_url).toBe(ICON);
    expect(brandingRow('rec1', { iconUrl: undefined }).icon_url).toBeNull();
    expect('icon_url' in brandingRow('rec1', { appName: 'X' })).toBe(false);
  });
});

describe('the manifest', () => {
  it('names the agency’s app and uses their icons and colour', () => {
    const spec = iconSpecFor({ appName: 'Sunseekers Holidays', brandPrimaryColour: '#0e7490' });
    const m = buildManifest(spec, 'Sunseekers Holidays');
    expect(m.name).toBe('Sunseekers Holidays');
    expect(m.short_name).toBe('Sunseekers');
    expect(m.theme_color).toBe('#0e7490');
    expect(m.id).toBe('/');
    expect(m.icons.map((i) => `${i.sizes} ${i.purpose}`)).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    expect(JSON.stringify(m)).not.toMatch(/Luna/);
  });

  it('keeps short names short', () => {
    expect(shortNameOf('Sunseekers')).toBe('Sunseekers');
    expect(shortNameOf('Exclusively Travel')).toBe('Exclusively');
    expect(shortNameOf('Supercalifragilistic Tours')).toBe('Supercalifra');
  });
});

import { badgeUrl, identityOf, parseIdentity, identityToSave, DEFAULT_SPEC, DEFAULT_APP_NAME } from '@/lib/app-icon';

describe('before anybody’s trip has loaded', () => {
  it('the app is “Your trip” with a plane, not ours', () => {
    const m = buildManifest(DEFAULT_SPEC, DEFAULT_APP_NAME);
    expect(m.name).toBe('Your trip');
    expect(m.icons[0].src).not.toMatch(/[?&]l=/);
    expect(JSON.stringify(m)).not.toMatch(/Luna|LT/);
  });
});

describe('the notification badge', () => {
  it('is the app’s letter, small, and never the uploaded picture', () => {
    const q = parseIconQuery(query(badgeUrl(iconSpecFor({ appName: 'Sunseekers', iconUrl: ICON }))));
    expect(q).toMatchObject({ size: 96, badge: true });
    expect(q?.spec.initial).toBe('S');
    expect(q?.spec.imageUrl).toBeUndefined();
  });
});

describe('the identity saved against a traveller', () => {
  const agency = { appName: 'Sunseekers', brandPrimaryColour: '#0e7490', brandAccentColour: '#f59e0b', iconUrl: ICON };

  it('reads back to exactly what was saved', () => {
    const saved = JSON.parse(JSON.stringify(identityOf(agency)));
    expect(parseIdentity(saved)).toEqual(identityOf(agency));
  });

  it('refuses anything it would not have saved', () => {
    expect(parseIdentity(null)).toBeNull();
    expect(parseIdentity({ name: 'X', spec: { primary: 'red', accent: '#f59e0b' } })).toBeNull();
    expect(parseIdentity({ name: '', spec: { primary: '#0e7490', accent: '#f59e0b' } })).toBeNull();
    expect(parseIdentity({ name: 'X', spec: { primary: '#0e7490', accent: '#f59e0b', imageUrl: 'https://evil.example/a.png' } })).toBeNull();
  });

  it('is written only when it has changed', () => {
    expect(identityToSave(null, agency)).toEqual(identityOf(agency));
    const saved = JSON.parse(JSON.stringify(identityOf(agency)));
    expect(identityToSave(saved, agency)).toBeNull();
    expect(identityToSave(saved, { ...agency, appName: 'Sunseekers Holidays' })?.name).toBe('Sunseekers Holidays');
  });

  it('is not written for an app with no name to go by', () => {
    expect(identityToSave(null, {})).toBeNull();
  });
});
