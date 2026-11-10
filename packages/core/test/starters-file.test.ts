// @vitest-environment jsdom
/**
 * The shipped starter set: examples/starters.icontween.json (decision 019). The landing page
 * plays it and opens each one in the editor, and it can be imported like any project.
 *
 * The file is the source of truth: the owner tunes timing and feel in the editor and saves
 * the exported project over it. These checks only make sure it still reads and still fits
 * the icons it was made from. To write it again from the recipes in starters.ts (losing any
 * tuning): SEED_STARTERS=1 pnpm --filter @icontween/core test starters-file
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseProject, SCHEMA_VERSION, serializeProject, type Project } from '../src';
import { builds, load, TOKENS } from './starters';

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'examples');
const FILE = join(EXAMPLES, 'starters.icontween.json');

/** Starter key → the Lucide icon it is prepared from. */
const SOURCE_OF: Record<string, string> = {
  'play-pause': 'pause',
  'menu-x': 'menu',
  'lock-unlock': 'lock',
  'eye-eye-off': 'eye-off',
  'volume-mute': 'volume-2',
  'copy-check': 'copy',
  send: 'send',
  download: 'download',
  bell: 'bell',
  heart: 'heart',
  search: 'search',
  'refresh-cw': 'refresh-cw',
};

/** The id the app gives a built-in starter icon (apps/web/src/starters.ts). */
const appId = (icon: string) => `lucide-${icon}`;

describe.runIf(process.env.SEED_STARTERS)('seed', () => {
  it('writes the starters file from the recipes', () => {
    const project: Project = {
      schemaVersion: SCHEMA_VERSION,
      name: 'IconTween starters',
      motionTokens: TOKENS,
      library: [], // every icon is a built-in starter
      animations: Object.entries(builds).map(([key, build]) => {
        const icon = SOURCE_OF[key]!;
        // Named and keyed the way the editor does when it opens a starter icon.
        return { ...build(), id: appId(icon), name: icon };
      }),
    };
    writeFileSync(FILE, serializeProject(project));
  });
});

describe('starters file', () => {
  const read = () => {
    const result = parseProject(readFileSync(FILE, 'utf8'));
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };

  it('reads as a project, with the same checks as Import', () => {
    const project = read();
    expect(project.library).toEqual([]);
    expect(project.animations.map((a) => a.id).sort()).toEqual(
      Object.values(SOURCE_OF).map(appId).sort(),
    );
  });

  it('is formatted the way Export writes it', () => {
    expect(readFileSync(FILE, 'utf8')).toBe(serializeProject(read()));
  });

  it.each(Object.values(SOURCE_OF))('%s still has the structure of its source icon', (icon) => {
    const animation = read().animations.find((a) => a.id === appId(icon))!;
    const prepared = load(icon);
    expect(animation.viewBox).toEqual(prepared.viewBox);
    expect(animation.elements).toEqual(prepared.elements);
    for (const state of animation.states) {
      for (const el of prepared.elements) {
        const cmds = (id: string, s = state) => s.elements[id]!.segments.map((seg) => seg.cmd);
        expect(cmds(el.id)).toEqual(prepared.state.elements[el.id]!.segments.map((s) => s.cmd));
      }
    }
  });
});
