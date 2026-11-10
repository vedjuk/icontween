import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SITE_URL } from '../src';

const root = new URL('../../../', import.meta.url);

/** Files that name the site but can't import SITE_URL, so they spell it out. */
const FILES = [
  'apps/web/index.html',
  'packages/runtime/scripts/bundle.js',
  'packages/runtime/types/icontween.d.ts',
  'README.md',
];

describe('SITE_URL', () => {
  it.each(FILES)('%s names the same address', (file) => {
    const text = readFileSync(new URL(file, root), 'utf8');
    expect(text).toContain(SITE_URL);
    // The old address, from before the site moved to a subdomain (decision 022).
    expect(text).not.toMatch(/\/\/icontween\.com/);
  });
});
