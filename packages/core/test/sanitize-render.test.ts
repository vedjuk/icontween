// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { iconToSvg, prepareSvg, sanitizeSvg, transformAttribute } from '../src';
import { elementState } from './fixtures';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'svg');
const fixture = (name: string) => readFileSync(join(FIXTURES, `${name}.svg`), 'utf8');

describe('sanitizeSvg', () => {
  it('strips dangerous content and keeps the drawing', () => {
    const result = sanitizeSvg(fixture('malicious'));
    if (!result.ok) throw new Error(result.error);
    expect(result.svg).not.toMatch(
      /script|foreignObject|onload|onclick|evil|javascript|<image|<use/i,
    );
    expect(result.svg).toContain('d="M2 2 L22 22"');
    expect(result.svg).toContain('stroke-width: 2');
    expect(result.removed.length).toBeGreaterThan(0);
  });

  it('always outputs the SVG namespace and a viewBox, without fixed size', () => {
    const plain = sanitizeSvg(fixture('no-namespace'));
    const sized = sanitizeSvg(fixture('no-viewbox'));
    if (!plain.ok || !sized.ok) throw new Error('expected ok');
    expect(
      plain.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"'),
    ).toBe(true);
    expect(sized.svg).toContain('viewBox="0 0 32 16"');
    expect(sized.svg).not.toMatch(/\swidth=|\sheight=/);
  });

  it('keeps root presentation attributes', () => {
    const result = sanitizeSvg(fixture('lucide-search'));
    if (!result.ok) throw new Error(result.error);
    expect(result.svg).toContain('stroke="currentColor"');
    expect(result.svg).toContain('stroke-linecap="round"');
    expect(result.svg).not.toContain('class=');
  });

  it('round-trips: sanitized output parses and sanitizes to the same markup', () => {
    const once = sanitizeSvg(fixture('inline-styles'));
    if (!once.ok) throw new Error(once.error);
    const twice = sanitizeSvg(once.svg);
    expect(twice.ok && twice.svg).toBe(once.svg);
  });

  it('shares the parse errors of prepareSvg', () => {
    expect(sanitizeSvg('<svg')).toEqual({ ok: false, error: expect.stringContaining('valid SVG') });
  });
});

describe('iconToSvg', () => {
  it('renders readable, formatted markup', () => {
    const result = prepareSvg(fixture('lucide-search'));
    if (!result.ok) throw new Error(result.error);
    const { viewBox, elements, state } = result.icon;
    expect(iconToSvg(viewBox, elements, state.elements, { size: 24 })).toBe(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">',
        '  <path d="M19 11 C19 15.418 15.418 19 11 19 C6.582 19 3 15.418 3 11 C3 6.582 6.582 3 11 3 C15.418 3 19 6.582 19 11 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />',
        '  <path d="M21 21 L16.7 16.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />',
        '</svg>',
      ].join('\n'),
    );
  });

  it('output prepares back to the same geometry', () => {
    const first = prepareSvg(fixture('lucide-bell'));
    if (!first.ok) throw new Error(first.error);
    const { viewBox, elements, state } = first.icon;
    const second = prepareSvg(iconToSvg(viewBox, elements, state.elements));
    expect(second.ok && second.icon.state).toEqual(state);
  });

  it('writes transforms around the pivot and non-default opacity', () => {
    const es = elementState([{ cmd: 'M', x: 0, y: 0 }], { opacity: 0.25 });
    expect(transformAttribute(es)).toBe('');
    es.transform = { ...es.transform, translateX: 1, rotate: 45, scale: 1.5 };
    expect(transformAttribute(es)).toBe(
      'translate(1 0) translate(12 12) rotate(45) scale(1.5) translate(-12 -12)',
    );
  });
});
