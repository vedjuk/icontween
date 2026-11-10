/**
 * Exported HTML really plays: the page core's exportHtml() writes, with the runtime built
 * the way the editor ships it, runs in a browser-like DOM (jsdom with real frames).
 */
import { exportHtml, type Animation } from '@icontween/core';
import { JSDOM } from 'jsdom';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundleRuntime } from '../scripts/bundle.js';
import { testAnimation } from './helpers';

let iife = '';
let esm = '';
beforeAll(async () => {
  [iife, esm] = await Promise.all([
    bundleRuntime({ format: 'iife' }),
    bundleRuntime({ format: 'es' }),
  ]);
}, 30_000);

const NO_TOKENS = { durations: {}, easings: {} };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Opens an exported page. `reduce` answers prefers-reduced-motion. */
function open(animation: Animation, reduce = false) {
  const html = exportHtml(animation, NO_TOKENS, { runtime: iife }).text;
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.matchMedia = ((query: string) => ({
        matches: reduce && query.includes('reduce'),
      })) as unknown as typeof window.matchMedia;
    },
  });
  const doc = dom.window.document;
  const d = () => doc.querySelector('path')!.getAttribute('d');
  return { dom, doc, d };
}

describe('exported HTML', () => {
  it('starts in state A and plays to B on click', async () => {
    const { dom, doc, d } = open(testAnimation({ trigger: { type: 'click' } }));
    expect(d()).toBe('M0 0 L10 0');
    doc.querySelector('button')!.click();
    await wait(60);
    const y = Number(d()!.split(' ')[1]);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(10);
    await wait(150);
    expect(d()).toBe('M0 10 L10 10');
    dom.window.close();
  });

  it('follows prefers-reduced-motion (instant: no in-between frames)', () => {
    const { dom, doc, d } = open(testAnimation({ trigger: { type: 'click' } }), true);
    doc.querySelector('button')!.click();
    expect(d()).toBe('M0 10 L10 10');
    dom.window.close();
  });

  it("stays still when reduced motion is 'none'", async () => {
    const a = testAnimation({ trigger: { type: 'click' }, reducedMotion: { mode: 'none' } });
    const { dom, doc, d } = open(a, true);
    doc.querySelector('button')!.click();
    await wait(150);
    expect(d()).toBe('M0 0 L10 0');
    dom.window.close();
  });

  it('plays manual animations from the Play button', async () => {
    const { dom, doc, d } = open(testAnimation({ trigger: { type: 'manual' } }));
    doc.querySelector('button')!.click();
    await wait(200);
    expect(d()).toBe('M0 10 L10 10');
    dom.window.close();
  });
});

describe('runtime bundles', () => {
  it('are readable: unminified, with doc comments and a licence banner', () => {
    for (const code of [iife, esm]) {
      expect(code.startsWith('/*!\n * IconTween runtime')).toBe(true);
      expect(code).toContain('MIT License');
      expect(code).toContain('function createPlayer(svg, animation, options = {})');
      expect(code).toContain('/** State ids along the sequence');
    }
    expect(iife).toContain('var IconTween = (function(exports) {');
    expect(esm).toMatch(/export \{[^}]*createPlayer/);
  });
});
