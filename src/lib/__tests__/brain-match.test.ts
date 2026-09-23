import { describe, it, expect } from 'vitest';
import { knowledgeFormula } from '@/lib/luna-brain';

/**
 * Which Luna Brain answers a destination page asks for.
 *
 * The match used to be FIND, which matches inside words: "promenade" contains
 * "rome", so a Rome trip listed things to do in the Côte d'Azur, India, Las
 * Vegas and Hong Kong (WCS96420, 23 Sep 2026). These run the formula's own
 * patterns against the real Search Index text of those rows.
 */

/** Pull each REGEX_MATCH pattern out of the formula and run it here. */
function matches(formula: string, text: string): boolean {
  const patterns = [...formula.matchAll(/REGEX_MATCH\(LOWER\(\{[^}]+\}\),'([^']+)'\)/g)].map((m) => new RegExp(m[1]));
  return patterns.some((re) => re.test(text.toLowerCase()));
}

const ROME = knowledgeFormula(['Rome', 'Italy']);

describe('matching Luna Brain to a destination', () => {
  it('no longer finds Rome inside "promenade"', () => {
    for (const text of [
      'Popular things to do in Cote d\'Azur include: Promenade Le Corbusier; Loulou Pirate',
      'Popular things to do in India include: Taj Mahal; Carter Road Promenade; Cubbon Park',
      'Popular things to do in Las Vegas include: The LINQ Promenade; Sphere',
      'Popular things to do in Hong Kong include: Victoria Peak; Tsim Sha Tsui Promenade',
    ]) {
      expect(matches(ROME, text), text).toBe(false);
    }
  });

  it('still finds Rome and Italy as words, wherever they sit', () => {
    expect(matches(ROME, 'What are the top things to do in Rome?')).toBe(true);
    expect(matches(ROME, 'Rome')).toBe(true);
    expect(matches(ROME, 'rome, italy')).toBe(true);
    expect(matches(ROME, 'Things To Do Italy')).toBe(true);
    expect(matches(ROME, 'Rome-Fiumicino airport')).toBe(true);
  });

  it('matches a two-word place as a phrase', () => {
    const f = knowledgeFormula(['Las Vegas']);
    expect(matches(f, 'What events are coming up in Las Vegas?')).toBe(true);
    expect(matches(f, 'glass vegas')).toBe(false);
  });

  // A hotel city comes from the booking; it must not be able to say anything
  // to the formula or the regex.
  it('cannot be broken by what a booking puts in a place name', () => {
    const f = knowledgeFormula(["Rome') OR TRUE() OR ('", 'a.*', 'Zürich']);
    expect(f).not.toMatch(/TRUE\(\)|\.\*/);
    expect(f.split("'").length % 2).toBe(1); // every quote is paired
  });

  it('never offers agent-only answers', () => {
    expect(ROME.startsWith("AND(NOT({Audience}='Agent'),")).toBe(true);
  });

  it('ignores tokens too short to mean a place', () => {
    expect(knowledgeFormula(['it', 'uk'])).toBe("AND(NOT({Audience}='Agent'),OR())");
  });
});
