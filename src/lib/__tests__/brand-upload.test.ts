import { describe, it, expect } from 'vitest';
import { isOwnBrandPath, brandPath, BRAND_IMAGE_TYPES } from '@/lib/brand-upload';

/**
 * An agency uploads its own logo and icon straight to Blob storage. The upload
 * route only hands out a token for a path inside the signed-in agency's own
 * folder, so one agency can never write over another's branding.
 */

const MINE = 'recABCDEFGHIJKLMN';
const THEIRS = 'recZZZZZZZZZZZZZZ';

describe('isOwnBrandPath', () => {
  it('allows the agency its own logo and icon folders', () => {
    expect(isOwnBrandPath(`agency-logos/${MINE}-1700000000000-logo.png`, MINE)).toBe(true);
    expect(isOwnBrandPath(`agency-icons/${MINE}-1700000000000-icon.png`, MINE)).toBe(true);
  });

  it("refuses another agency's folder", () => {
    expect(isOwnBrandPath(`agency-logos/${THEIRS}-1-logo.png`, MINE)).toBe(false);
  });

  // An id that merely starts the same must not match: recABC… is not recABCD….
  it('refuses a path that only shares a prefix with the agency id', () => {
    expect(isOwnBrandPath(`agency-logos/${MINE}X-1-logo.png`, MINE.slice(0, -1))).toBe(false);
  });

  it('refuses anywhere else, and any attempt to climb out', () => {
    for (const p of [
      `documents/${MINE}-1-x.pdf`,
      `agency-logos/${MINE}-1/../../${THEIRS}-1-x.png`,
      `agency-logos//${MINE}-1-x.png`,
      `agency-logos\\${MINE}-1-x.png`,
      '',
      undefined,
    ]) {
      expect(isOwnBrandPath(p, MINE), String(p)).toBe(false);
    }
  });

  it('refuses everything without an agency', () => {
    expect(isOwnBrandPath(`agency-logos/-1-logo.png`, '')).toBe(false);
  });
});

describe('brandPath', () => {
  it('builds a path the rule accepts, with the file name made safe', () => {
    const p = brandPath('logo', MINE, 'My Logo (final) é.png', 1700000000000);
    expect(p).toBe(`agency-logos/${MINE}-1700000000000-MyLogofinal.png`);
    expect(isOwnBrandPath(p, MINE)).toBe(true);
  });

  it('never produces a path with nothing after the stamp', () => {
    expect(brandPath('icon', MINE, '????', 1)).toBe(`agency-icons/${MINE}-1-icon`);
  });
});

it('accepts raster images only: an uploaded SVG could run script', () => {
  expect(BRAND_IMAGE_TYPES).not.toContain('image/svg+xml');
});
