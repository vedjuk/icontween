// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  commentText,
  componentName,
  dataVariableName,
  exportFileBase,
  exportHtml,
  exportJson,
  exportReact,
  formatBytes,
  measureExport,
  printData,
  readAnimation,
  resolveTokens,
  type Animation,
  type MotionTokens,
} from '../src';
import { checkToDash } from './fixtures';

const tokens: MotionTokens = {
  durations: { fast: 150, base: 250, slow: 400 },
  easings: {
    standard: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
    snappy: { type: 'cubic-bezier', x1: 0.3, y1: 0, x2: 0, y2: 1 },
    'spring-gentle': { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
  },
};

const RUNTIME = 'var IconTween = { createPlayer() {} };';

function animation(patch: Partial<Animation> = {}): Animation {
  const a = checkToDash();
  a.sequence.steps[0]!.duration = { token: 'fast' };
  a.sequence.steps[0]!.easing = { type: 'token', name: 'snappy' };
  return { ...a, ...patch };
}

describe('printData', () => {
  it('keeps small values on one line', () => {
    expect(printData({ cmd: 'M', x: 1, y: -0 }, { syntax: 'json' })).toBe(
      '{ "cmd": "M", "x": 1, "y": 0 }',
    );
    expect(printData([0, 0, 24, 24], { syntax: 'js' })).toBe('[0, 0, 24, 24]');
    expect(printData({}, { syntax: 'js' })).toBe('{}');
  });

  it('breaks wide values into one entry per line', () => {
    const value = { name: 'x'.repeat(30), list: [1, 2, 3], nested: { a: 'y'.repeat(60) } };
    expect(printData(value, { syntax: 'json', width: 60 })).toBe(
      [
        '{',
        `  "name": "${'x'.repeat(30)}",`,
        '  "list": [1, 2, 3],',
        '  "nested": {',
        `    "a": "${'y'.repeat(60)}"`,
        '  }',
        '}',
      ].join('\n'),
    );
  });

  it('writes JavaScript with bare keys, single quotes and trailing commas', () => {
    const value = { id: "it's", 'el-1': 'a'.repeat(80) };
    expect(printData(value, { syntax: 'js' })).toBe(
      ['{', "  id: 'it\\'s',", `  'el-1': '${'a'.repeat(80)}',`, '}'].join('\n'),
    );
  });

  it('round-trips through JSON.parse', () => {
    const a = animation();
    expect(JSON.parse(printData(a, { syntax: 'json' }))).toEqual(a);
  });

  it('can sit inside a <script>', () => {
    const out = printData({ name: '</script><b>' }, { syntax: 'js', inScript: true });
    expect(out).not.toContain('<');
    expect(new Function(`return ${out}`)()).toEqual({ name: '</script><b>' });
  });

  it('drops undefined fields like JSON.stringify', () => {
    expect(printData({ a: 1, b: undefined }, { syntax: 'json' })).toBe('{ "a": 1 }');
  });
});

describe('export names', () => {
  it.each([
    ['Copy → Check', 'copy-check', 'CopyCheckIcon', 'copyCheckAnimation'],
    ['bell', 'bell', 'BellIcon', 'bellAnimation'],
    ['Search icon', 'search-icon', 'SearchIcon', 'searchIconAnimation'],
    ['Café crème', 'cafe-creme', 'CafeCremeIcon', 'cafeCremeAnimation'],
    ['2 step', '2-step', 'Icon2Step', 'icon2StepAnimation'],
    ['→', 'my-id', 'MyIdIcon', 'myIdAnimation'],
  ])('%s', (name, file, component, variable) => {
    const a = { name, id: 'my-id' };
    expect(exportFileBase(a)).toBe(file);
    expect(componentName(a)).toBe(component);
    expect(dataVariableName(a)).toBe(variable);
  });

  it('falls back to "icon" when there is nothing to use', () => {
    expect(componentName({ name: '', id: '' })).toBe('Icon');
  });

  it('keeps comment text on one line and unable to close the comment', () => {
    expect(commentText('a */ b\n--> c')).toBe('a * / b - -> c');
  });
});

describe('resolveTokens', () => {
  it('replaces token durations and easings with their values', () => {
    const resolved = resolveTokens(animation(), tokens);
    expect(resolved.sequence.steps[0]).toMatchObject({
      duration: 150,
      easing: { type: 'cubic-bezier', x1: 0.3, y1: 0, x2: 0, y2: 1 },
    });
  });

  it('uses base and standard for unknown tokens, like the runtime', () => {
    const a = animation();
    a.sequence.steps[0]!.duration = { token: 'nope' };
    a.sequence.steps[0]!.easing = { type: 'token', name: 'nope' };
    expect(resolveTokens(a, tokens).sequence.steps[0]).toMatchObject({
      duration: 250,
      easing: tokens.easings.standard,
    });
    expect(resolveTokens(a, { durations: {}, easings: {} }).sequence.steps[0]).toMatchObject({
      duration: 250,
      easing: { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 },
    });
  });

  it("doesn't change the animation it was given", () => {
    const a = animation();
    const copy = structuredClone(a);
    resolveTokens(a, tokens);
    expect(a).toEqual(copy);
  });
});

describe('exportJson', () => {
  it('reads back as the same animation, tokens resolved', () => {
    const file = exportJson(animation(), tokens);
    expect(file.fileName).toBe('check-dash.json');
    const data = JSON.parse(file.text);
    expect(data.schemaVersion).toBe(1);
    const read = readAnimation(data.animation);
    expect(read).toEqual({ ok: true, value: resolveTokens(animation(), tokens) });
    expect(file.text.endsWith('}\n')).toBe(true);
  });
});

describe('exportHtml', () => {
  const html = (patch: Partial<Animation> = {}) =>
    exportHtml(animation(patch), tokens, { runtime: RUNTIME }).text;
  const parse = (text: string) => new DOMParser().parseFromString(text, 'text/html');

  it('has the icon in state A, the runtime and the start call', () => {
    const doc = parse(html({ trigger: { type: 'click' } }));
    const svg = doc.querySelector('svg')!;
    expect(svg.id).toBe('check-dash-icon');
    const paths = svg.querySelectorAll('path[data-icontween-element]');
    expect(paths).toHaveLength(1);
    expect(paths[0]!.getAttribute('d')).toBe('M20 6 L9 17 L4 12');
    const button = doc.querySelector('button')!;
    expect(button.contains(svg)).toBe(true);
    const scripts = [...doc.querySelectorAll('script')].map((s) => s.textContent!);
    expect(scripts[0]).toContain(RUNTIME);
    expect(scripts[1]).toContain('listenOn: document.getElementById(');
  });

  it('its data script evaluates to the resolved animation', () => {
    const doc = parse(html());
    const script = doc.querySelectorAll('script')[1]!.textContent!;
    const data = script.slice(script.indexOf('=') + 1, script.indexOf('};') + 1);
    expect(new Function(`return ${data}`)()).toEqual(resolveTokens(animation(), tokens));
  });

  it('adds a Play button for manual animations, and no wrapper for loops', () => {
    expect(parse(html({ trigger: { type: 'manual' } })).body.textContent).toContain('Play');
    const loop = parse(html({ trigger: { type: 'loop' } }));
    expect(loop.querySelector('button')).toBeNull();
    expect(loop.querySelectorAll('script')[1]!.textContent).not.toContain('listenOn');
  });

  it('escapes the name wherever it appears', () => {
    const text = html({ name: '</script><img src=x onerror=alert(1)> -->' });
    const doc = parse(text);
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelectorAll('script')).toHaveLength(2);
    expect(doc.title).toBe('</script><img src=x onerror=alert(1)> - ->');
  });

  it('says how reduced motion is handled', () => {
    expect(html({ reducedMotion: { mode: 'fade' } })).toContain(
      'Reduced motion: when the OS asks for less motion, it cross-fades',
    );
  });
});

describe('exportReact', () => {
  it('names the component and types the states', () => {
    const file = exportReact(animation(), tokens);
    expect(file.fileName).toBe('CheckDashIcon.tsx');
    expect(file.text).toContain('export const CheckDashIcon = forwardRef<');
    expect(file.text).toContain("setState(state: 'A' | 'B'): void;");
    expect(file.text).toContain("from './icontween';");
    expect(file.text).toContain('strokeWidth={2}');
    expect(file.text).toContain('Reduced motion: when the OS asks for less motion');
  });
});

describe('measureExport', () => {
  it('counts UTF-8 bytes and the gzipped size', async () => {
    const size = await measureExport('→'.repeat(1000));
    expect(size.bytes).toBe(3000);
    expect(size.gzipped).toBeGreaterThan(0);
    expect(size.gzipped).toBeLessThan(100);
  });

  it('formats sizes', () => {
    expect(formatBytes(880)).toBe('880 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
  });
});
