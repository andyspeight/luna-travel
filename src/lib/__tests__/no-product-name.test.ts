import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * "Luna Brain" is our name for the knowledge base behind destination facts.
 * It meant nothing to a traveller, and the app they are reading belongs to
 * their travel agent, who may not call anything "Luna" at all (23 Sep 2026).
 * The destination page wore it as a badge on every section.
 *
 * So it never appears in text a traveller can see: the screens under src/app
 * (not the agency portal, admin or API) and the shared components. Comments
 * are stripped first, because a note to the next developer is never drawn.
 */

const SRC = join(__dirname, '..', '..');
const SKIP = new Set(['__tests__', 'api', 'admin', 'agency']);

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (SKIP.has(name)) continue;
      yield* files(full);
    } else if (/\.tsx$/.test(name)) {
      yield full;
    }
  }
}

function withoutComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`])\/\/.*$/gm, '$1');
}

describe('the knowledge base’s product name', () => {
  it('is not shown to travellers', () => {
    const offenders: string[] = [];
    for (const dir of [join(SRC, 'app'), join(SRC, 'components')]) {
      for (const f of files(dir)) {
        withoutComments(readFileSync(f, 'utf8'))
          .split('\n')
          .forEach((line, i) => {
            if (/Luna Brain/i.test(line)) offenders.push(`${relative(SRC, f)}:${i + 1}  ${line.trim().slice(0, 80)}`);
          });
      }
    }
    expect(offenders, `"Luna Brain" shown to travellers:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('is actually caught by the check', () => {
    expect(withoutComments('<span>Luna Brain</span>')).toMatch(/Luna Brain/);
    expect(withoutComments('// from Luna Brain')).not.toMatch(/Luna Brain/);
    expect(withoutComments('{/* Luna Brain first */}')).not.toMatch(/Luna Brain/);
  });
});
