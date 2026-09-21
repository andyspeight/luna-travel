import { describe, it, expect } from 'vitest';
import { allergensFor, ALLERGEN_ORDER, SHOW_DONT_SAY } from '@/lib/allergens';
import { phrasesFor } from '@/lib/phrasebook';

const LANGUAGES = [
  'Spanish', 'French', 'Italian', 'Portuguese', 'German', 'Greek',
  'Turkish', 'Dutch', 'Croatian', 'Polish', 'Thai', 'Arabic',
];

/**
 * These are medical phrases. A missing one is somebody unable to say what will
 * hurt them, and a half-finished one is worse than nothing, because it looks
 * like an answer.
 */

describe('every language covers every allergen', () => {
  it.each(LANGUAGES)('%s has all fourteen', (language) => {
    const set = allergensFor(language);
    expect(set).not.toBeNull();
    expect(set!.map((a) => a.en)).toEqual(ALLERGEN_ORDER);
  });

  it('covers the UK regulated fourteen, not a guess at the common ones', () => {
    // If somebody has a celery allergy, nobody else is writing this down.
    for (const required of ['Peanuts', 'Celery', 'Lupin', 'Mustard', 'Sulphites', 'Molluscs']) {
      expect(ALLERGEN_ORDER).toContain(required);
    }
    expect(ALLERGEN_ORDER).toHaveLength(14);
  });

  it('matches the phrase book language for language, so neither can drift', () => {
    for (const language of LANGUAGES) {
      expect(phrasesFor(language)?.language, language).toBe(language);
      expect(allergensFor(language), language).not.toBeNull();
    }
  });
});

describe('every line is a finished sentence', () => {
  // The whole point. The phrase book's "I'm allergic to…" is a stem, and a
  // stem is what sent the traveller back to English.
  it.each(LANGUAGES)('%s never leaves an ellipsis or a blank to fill', (language) => {
    for (const a of allergensFor(language)!) {
      expect(a.local, `${language} / ${a.en}`).not.toMatch(/[…]|\.\.\.|\{|\}|%s|_{2,}/);
      expect(a.local.trim().length, `${language} / ${a.en}`).toBeGreaterThan(3);
    }
  });

  it.each(LANGUAGES)('%s can be said as well as shown', (language) => {
    for (const a of allergensFor(language)!) {
      expect(a.say, `${language} / ${a.en}`).toBeTruthy();
      expect(a.say.trim().length, `${language} / ${a.en}`).toBeGreaterThan(3);
    }
  });

  // Catching untranslated English by substring does not work: "lupin" is the
  // French word, "Lupinen" the German, "soya" the Turkish. A cognate and a
  // paste look identical to a string match.
  //
  // The multi-word names have no such excuse. Nothing here is called "milk and
  // dairy" in Greek, so finding one verbatim means somebody pasted the label.
  it.each(LANGUAGES)('%s translated the multi-word names rather than pasting them', (language) => {
    for (const a of allergensFor(language)!) {
      if (!a.en.includes(' ')) continue;
      expect(a.local.toLowerCase(), `${language} / ${a.en}`).not.toContain(a.en.toLowerCase());
    }
  });
});

describe('no two allergens share a sentence', () => {
  // A copy-paste slip would tell somebody with a fish allergy to avoid milk.
  it.each(LANGUAGES)('%s says something different for each', (language) => {
    const locals = allergensFor(language)!.map((a) => a.local);
    expect(new Set(locals).size, language).toBe(locals.length);
  });
});

describe('the language-specific traps are handled', () => {
  // Turkish puts the allergen first and suffixes the possessive — the clearest
  // proof that these cannot be built from one template.
  it('Turkish leads with the allergen, not the verb', () => {
    const peanuts = allergensFor('Turkish')!.find((a) => a.en === 'Peanuts')!;
    expect(peanuts.local).toBe('Yer fıstığı alerjim var');
    expect(peanuts.local.startsWith('Yer')).toBe(true);
  });

  // Greek contracts preposition and article by gender: στα / στο / στη.
  it('Greek uses the article the noun actually takes', () => {
    const greek = allergensFor('Greek')!;
    expect(greek.find((a) => a.en === 'Eggs')!.local).toContain('στα');
    expect(greek.find((a) => a.en === 'Fish')!.local).toContain('στο');
    expect(greek.find((a) => a.en === 'Soya')!.local).toContain('στη');
  });

  // Polish takes the accusative after "na".
  it('Polish inflects rather than using the dictionary form', () => {
    const polish = allergensFor('Polish')!;
    expect(polish.find((a) => a.en === 'Soya')!.local).toContain('soję');
    expect(polish.find((a) => a.en === 'Mustard')!.local).toContain('gorczycę');
  });

  // Spanish and Italian need the article to agree.
  it('Spanish picks the right article per noun', () => {
    const spanish = allergensFor('Spanish')!;
    expect(spanish.find((a) => a.en === 'Milk and dairy')!.local).toContain('a la leche');
    expect(spanish.find((a) => a.en === 'Eggs')!.local).toContain('al huevo');
    expect(spanish.find((a) => a.en === 'Peanuts')!.local).toContain('a los cacahuetes');
  });

  // The one that could genuinely embarrass somebody: μαλάκια is a slip away
  // from a well-known insult, so it must carry a warning and an alternative.
  it('warns about the Greek word for molluscs', () => {
    const molluscs = allergensFor('Greek')!.find((a) => a.en === 'Molluscs')!;
    expect(molluscs.note).toBeTruthy();
    expect(molluscs.note).toMatch(/θαλασσινά/);
  });
});

describe('gender', () => {
  // "I have an allergy to" rather than "I am allergic to", so one line serves
  // every traveller instead of needing a masculine and a feminine form.
  it('avoids the gendered adjective the phrase book has to footnote', () => {
    expect(allergensFor('Spanish')!.every((a) => !/alérgic[oa]/.test(a.local))).toBe(true);
    expect(allergensFor('Italian')!.every((a) => !/allergic[oa]\b/.test(a.local))).toBe(true);
    expect(allergensFor('Croatian')!.every((a) => !/alergičn?[ai]\b/.test(a.local))).toBe(true);
  });
});

describe('unknown languages', () => {
  it('returns null rather than guessing', () => {
    expect(allergensFor('Klingon')).toBeNull();
    expect(allergensFor('')).toBeNull();
    expect(allergensFor(null)).toBeNull();
    expect(allergensFor(undefined)).toBeNull();
  });

  it('has no entry for English, same as the phrase book', () => {
    expect(allergensFor('English')).toBeNull();
  });
});

describe('the advice to the traveller', () => {
  it('tells them to show it rather than say it', () => {
    expect(SHOW_DONT_SAY).toMatch(/show/i);
    expect(SHOW_DONT_SAY).toMatch(/aloud|pronounc/i);
  });
});
