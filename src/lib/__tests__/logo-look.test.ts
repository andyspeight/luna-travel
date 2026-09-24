import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { toneOf, plateFor, isWordmark, parseLogoMeta, aspectOf } from '@/lib/logo-look';
import { measureLogo, isStoredLogoUrl } from '@/lib/logo-analyze';

/**
 * World Choice Sports uploaded a wide logo: a coloured door mark with white
 * lettering beside it on transparency. The app squeezed it into a small white
 * square, so it became a speck and the lettering vanished (24 Sep 2026).
 */

// Test images drawn here rather than kept as files.
const svg = (w: number, h: number, body: string) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)).png().toBuffer();

// A mark on the left and "lettering" (white bars) across the rest.
const whiteWordmark = () =>
  svg(540, 90, `<rect x="0" y="0" width="80" height="90" fill="#dc2626"/><rect x="100" y="20" width="420" height="22" fill="#ffffff"/><rect x="100" y="50" width="380" height="22" fill="#ffffff"/>`);
const darkWordmark = () =>
  svg(540, 90, `<rect x="100" y="20" width="420" height="22" fill="#0f172a"/><rect x="100" y="50" width="380" height="22" fill="#111827"/>`);
const boxedSquare = () => svg(300, 300, `<rect width="300" height="300" fill="#1b2b5b"/><rect x="60" y="60" width="180" height="180" fill="#00b4d8"/>`);

describe('measuring a logo', () => {
  it('knows white lettering on transparency is a light logo, and its shape', async () => {
    const m = await measureLogo(await whiteWordmark());
    expect(m).toEqual({ w: 540, h: 90, tone: 'light' });
    expect(isWordmark(m)).toBe(true);
  });

  it('knows dark lettering is a dark logo', async () => {
    expect((await measureLogo(await darkWordmark())).tone).toBe('dark');
  });

  it('knows a logo that brings its own background', async () => {
    const m = await measureLogo(await boxedSquare());
    expect(m.tone).toBe('boxed');
    expect(isWordmark(m)).toBe(false);
  });

  it('does not fall over on something that is not an image', async () => {
    await expect(measureLogo(Buffer.from('not an image'))).rejects.toBeTruthy();
  });
});

describe('what goes behind a logo', () => {
  it('puts light lettering straight onto a dark screen, and on a plate on a light one', () => {
    expect(plateFor('light', 'dark')).toBe('none');
    expect(plateFor('light', 'light')).toBe('dark');
  });

  it('puts dark lettering on white only where the screen is dark', () => {
    expect(plateFor('dark', 'light')).toBe('none');
    expect(plateFor('dark', 'dark')).toBe('white');
  });

  it('leaves a logo with its own background alone', () => {
    expect(plateFor('boxed', 'light')).toBe('none');
    expect(plateFor('boxed', 'dark')).toBe('none');
  });

  it('treats an unmeasured logo the way logos are usually designed, for white', () => {
    expect(plateFor(undefined, 'light')).toBe('none');
    expect(plateFor('unknown', 'dark')).toBe('white');
    expect(plateFor('mixed', 'dark')).toBe('white');
  });
});

describe('the tone rule', () => {
  it('draws its lines where the tests above rely on them', () => {
    expect(toneOf({ opaque: 0.18, light: 0.71, dark: 0.12 })).toBe('light'); // the real logo
    expect(toneOf({ opaque: 0.96, light: 0.09, dark: 0.34 })).toBe('boxed'); // the old LT icon
    expect(toneOf({ opaque: 0.3, light: 0.4, dark: 0.4 })).toBe('mixed');
  });
});

describe('a stored measurement', () => {
  it('reads back, and refuses what it would not have stored', () => {
    expect(parseLogoMeta({ w: 540, h: 90, tone: 'light' })).toEqual({ w: 540, h: 90, tone: 'light' });
    expect(parseLogoMeta({ tone: 'purple' })).toBeNull();
    expect(parseLogoMeta(null)).toBeNull();
    expect(aspectOf(parseLogoMeta({ w: 0, h: 0, tone: 'unknown' }))).toBeNull();
  });
});

describe('which logos are ever fetched to be measured', () => {
  it('only our store’s logo folder', () => {
    expect(isStoredLogoUrl('https://z39fzpm0qetfheg1.public.blob.vercel-storage.com/agency-logos/recA-1-logo.png')).toBe(true);
    expect(isStoredLogoUrl('https://z39fzpm0qetfheg1.public.blob.vercel-storage.com/agency-icons/recA-1.png')).toBe(false);
    expect(isStoredLogoUrl('https://example.com/agency-logos/logo.png')).toBe(false);
    expect(isStoredLogoUrl('http://abc.public.blob.vercel-storage.com/agency-logos/x.png')).toBe(false);
    expect(isStoredLogoUrl('https://169.254.169.254/agency-logos/x.png')).toBe(false);
  });
});
