import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * No emoji as graphics anywhere a traveller or an agent can see.
 *
 * The app had a palm tree for a header, a satellite dish for the offline
 * screen, flags for languages and a sparkle or a plane tacked onto shared
 * messages. They render differently on every platform — Windows draws a flag
 * emoji as two bare letters — they do not take the theme's colours, and they
 * are not the look this product wants. Icons come from the one SVG set in
 * components/icons, which takes colour, size and dark mode like everything
 * else.
 *
 * Comments are stripped before scanning: an emoji in a note to the next
 * developer is never drawn. Typographic marks (· — ’ ✓ ×) are not emoji and
 * are not matched.
 */

const SRC = join(__dirname, '..', '..');

// Pictographs, dingbat stars and regional-indicator flags.
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2714}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}]/u;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'api') continue;
      yield* files(full);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      yield full;
    }
  }
}

/** Drop // and /* *\/ comments so a note in the source is not a failure. */
function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1');
}

describe('emoji', () => {
  it('are not used as graphics anywhere in the app', () => {
    const offenders: string[] = [];
    for (const f of files(SRC)) {
      const lines = withoutComments(readFileSync(f, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        const m = line.match(EMOJI);
        if (m) offenders.push(`${relative(SRC, f)}:${i + 1} ${m[0]}  ${line.trim().slice(0, 70)}`);
      });
    }
    expect(offenders, `emoji found:\n${offenders.join('\n')}`).toEqual([]);
  });

  // Guards the guard: if the pattern stopped matching, the test above would
  // pass for ever and protect nothing.
  it('are actually recognised by the check', () => {
    for (const e of ['🌴', '📡', '✈️', '✨', '🇬🇧', '☀️', '✦', '⚠️']) {
      expect(EMOJI.test(e), e).toBe(true);
    }
    for (const ok of ['·', '—', '’', '✓', '×', '→', '£']) {
      expect(EMOJI.test(ok), ok).toBe(false);
    }
  });
});
