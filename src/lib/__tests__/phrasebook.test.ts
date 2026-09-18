import { describe, it, expect } from 'vitest';
import { phrasesFor, PHRASE_LANGUAGES } from '@/lib/phrasebook';

describe('phrasesFor', () => {
  it('matches a single-language cell', () => {
    expect(phrasesFor('Greek')?.language).toBe('Greek');
    expect(phrasesFor('Turkish')?.language).toBe('Turkish');
  });

  // The cells are written most-spoken-first, so that order is the answer.
  it('follows the order the cell is written in', () => {
    expect(phrasesFor('Dutch, French')?.language).toBe('Dutch');
    expect(phrasesFor('French, Tahitian')?.language).toBe('French');
    expect(phrasesFor('Arabic, French')?.language).toBe('Arabic');
  });

  it('skips past languages we have no set for', () => {
    expect(phrasesFor('Papiamento, Dutch')?.language).toBe('Dutch');
    expect(phrasesFor('Maltese, English')).toBeNull();
  });

  // A phrase book for somewhere they already speak your language is clutter.
  it('offers nothing for an English-speaking destination', () => {
    expect(phrasesFor('English')).toBeNull();
    expect(phrasesFor('English, Irish')).toBeNull();
  });

  it('offers nothing rather than something wrong', () => {
    expect(phrasesFor('Dhivehi')).toBeNull();
    expect(phrasesFor('')).toBeNull();
    expect(phrasesFor(null)).toBeNull();
  });

  it('does not match a language inside another word', () => {
    // Guard against a bare substring test matching "Thai" inside "Thailand" is
    // fine, but "Polish" must not be found in "polishing".
    expect(phrasesFor('polishing cloth')).toBeNull();
  });
});

describe('every phrase set', () => {
  const sets = PHRASE_LANGUAGES.map((l) => phrasesFor(l)!);

  it('covers every language it claims to', () => {
    expect(sets.every(Boolean)).toBe(true);
    expect(sets).toHaveLength(12);
  });

  it('gives every phrase something to say out loud', () => {
    for (const set of sets) {
      for (const group of set.groups) {
        for (const phrase of group.phrases) {
          expect(phrase.en.length, `${set.language}: english`).toBeGreaterThan(0);
          expect(phrase.local.length, `${set.language}: ${phrase.en}`).toBeGreaterThan(0);
          // A phrase book you cannot pronounce is decoration.
          expect(phrase.say?.length, `${set.language}: ${phrase.en} has no pronunciation`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('carries the phrases that actually matter in an emergency', () => {
    for (const set of sets) {
      const all = set.groups.flatMap((g) => g.phrases.map((p) => p.en));
      expect(all, set.language).toContain('I need a doctor');
      expect(all, set.language).toContain('Help!');
      expect(all, set.language).toContain("I'm allergic to…");
    }
  });

  it('has a speech tag the browser can use', () => {
    for (const set of sets) {
      expect(set.speechLang, set.language).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    }
  });

  // Not a style rule: an unreviewed set is one we should not be promoting.
  it('records whether a native speaker has checked it', () => {
    for (const set of sets) {
      expect(typeof set.reviewedBy, set.language).toBe('string');
    }
  });
});
