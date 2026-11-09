// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSvg, segmentsToD, transformAttribute } from '@icontween/core';
import { describe, expect, it } from 'vitest';
import { createPlayer, ELEMENT_ATTRIBUTE, toD, toTransform } from '../src';
import { elementState, line, makeSvg, testAnimation } from './helpers';

const SOURCES = join(dirname(fileURLToPath(import.meta.url)), '../../../examples/source');

describe('toD / toTransform match core', () => {
  it('serializes every starter icon exactly like segmentsToD()', () => {
    for (const file of readdirSync(SOURCES).filter((f) => f.endsWith('.svg'))) {
      const result = prepareSvg(readFileSync(join(SOURCES, file), 'utf8'));
      if (!result.ok) throw new Error(`${file}: ${result.error}`);
      for (const es of Object.values(result.icon.state.elements)) {
        expect(toD(es)).toBe(segmentsToD(es.segments));
      }
    }
  });

  it('formats awkward numbers the same way', () => {
    const es = elementState([
      { cmd: 'M', x: -0.0001, y: 1.23456 },
      { cmd: 'C', x1: 1e-7, y1: 2.5, x2: -3.0005, y2: 4, x: 5.9999, y: 6 },
      { cmd: 'Z' },
    ]);
    expect(toD(es)).toBe(segmentsToD(es.segments));
  });

  it('writes transforms like transformAttribute()', () => {
    const cases = [
      {},
      { translateX: 1.5 },
      { rotate: 45 },
      { scale: 0.5, originX: 3 },
      { translateX: -2, translateY: 4, rotate: -12.3456, scale: 1.2, originX: 7, originY: 9 },
    ];
    for (const t of cases) {
      const base = elementState(line(0, 0, 1, 1));
      const es = { ...base, transform: { ...base.transform, ...t } };
      expect(toTransform(es)).toBe(transformAttribute(es));
    }
  });
});

describe('binding paths', () => {
  it('creates missing paths with styles and a viewBox', () => {
    const svg = makeSvg();
    createPlayer(svg, testAnimation());
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(paths[0]!.getAttribute(ELEMENT_ATTRIBUTE)).toBe('el-1');
    expect(paths[0]!.getAttribute('d')).toBe('M0 0 L10 0');
    expect(paths[0]!.getAttribute('stroke-width')).toBe('2');
    expect(paths[0]!.getAttribute('fill')).toBe('none');
    expect(paths[0]!.hasAttribute('transform')).toBe(false);
    expect(paths[0]!.hasAttribute('opacity')).toBe(false);
  });

  it('reuses existing markup (inline-SVG exports)', () => {
    const svg = makeSvg();
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.innerHTML = `<path ${ELEMENT_ATTRIBUTE}="el-2" class="keep" d="M0 1 L10 1" />`;
    createPlayer(svg, testAnimation());
    const paths = svg.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]!.getAttribute('class')).toBe('keep');
    expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
  });

  it('renders partial drawing with pathLength dashes, and hides a fully undrawn path', () => {
    const anim = testAnimation();
    anim.states[0]!.elements['el-1']!.draw = { start: 0.25, end: 0.75 };
    anim.states[0]!.elements['el-2']!.draw = { start: 0.5, end: 0.5 };
    const svg = makeSvg();
    createPlayer(svg, anim);
    const [a, b] = svg.querySelectorAll('path');
    expect(a!.getAttribute('pathLength')).toBe('1');
    expect(a!.getAttribute('stroke-dasharray')).toBe('0.5 2');
    expect(a!.getAttribute('stroke-dashoffset')).toBe('-0.25');
    expect(b!.getAttribute('opacity')).toBe('0');
  });
});
