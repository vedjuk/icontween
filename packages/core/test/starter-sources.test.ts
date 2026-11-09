// @vitest-environment jsdom
/**
 * Every Lucide source in examples/source must prepare cleanly: no warnings, nothing
 * left out, canonical paths, and a valid one-state animation.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { prepareSvg, validateAnimation } from '../src';

const SOURCES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'examples',
  'source',
);
const files = readdirSync(SOURCES).filter((f) => f.endsWith('.svg'));

describe('starter sources', () => {
  it('has the full set', () => {
    expect(files.length).toBeGreaterThanOrEqual(18);
  });

  it.each(files)('%s prepares cleanly', (file) => {
    const result = prepareSvg(readFileSync(join(SOURCES, file), 'utf8'));
    if (!result.ok) throw new Error(result.error);
    expect(result.report.warnings).toEqual([]);
    expect(result.report.skipped).toEqual([]);
    expect(result.report.removed).toEqual([]);
    for (const es of Object.values(result.icon.state.elements)) {
      expect(es.segments.every((s) => 'MLCZ'.includes(s.cmd))).toBe(true);
    }
    const valid = validateAnimation({
      id: file,
      name: file,
      purpose: 'feedback',
      viewBox: result.icon.viewBox,
      elements: result.icon.elements,
      states: [result.icon.state],
      sequence: { steps: [], repeat: 'once' },
      trigger: { type: 'manual' },
      reducedMotion: { mode: 'instant' },
    });
    expect(valid).toEqual({ ok: true });
  });
});
