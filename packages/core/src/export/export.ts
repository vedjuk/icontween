/**
 * Exports: one animation as code a developer can paste or download (brief §11,
 * decision 016). Every format plays with the same runtime as the editor preview (rule 9),
 * is formatted for people (rule 7) and follows prefers-reduced-motion (rule 8).
 *
 * - JSON: the animation data, for driving the runtime yourself.
 * - HTML: an inline SVG plus the runtime and a few lines that start it. Opens from disk.
 * - React: a typed component that imports the runtime from `./icontween`.
 *
 * Token references are resolved to plain numbers and curves, so an export doesn't depend on
 * the project's motion tokens.
 */
import { formatNumber } from '../path';
import { pathAttributes } from '../render';
import { SCHEMA_VERSION, type Animation, type Easing, type TriggerType } from '../schema';
import type { MotionTokens } from '../tokens';
import { commentText, componentName, dataVariableName, exportFileBase } from './names';
import { printData } from './print';

/** The attribute that links a <path> to its element id (the runtime's ELEMENT_ATTRIBUTE). */
export const EXPORT_ELEMENT_ATTRIBUTE = 'data-icontween-element';

/** Where the React export expects the runtime, relative to the component file. */
export const RUNTIME_MODULE = './icontween';

export interface ExportFile {
  fileName: string;
  /** MIME type for downloads. */
  type: string;
  text: string;
}

/** Fallback curve for unknown easing tokens, the same as the runtime's `standard`. */
const STANDARD: Easing = { type: 'cubic-bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 };

/**
 * The animation with every token replaced by its value, as the runtime would resolve it:
 * unknown duration tokens use `base` (or 250 ms), unknown easing tokens the `standard` curve.
 */
export function resolveTokens(animation: Animation, tokens: MotionTokens): Animation {
  const steps = animation.sequence.steps.map((step) => {
    const duration =
      typeof step.duration === 'number'
        ? step.duration
        : (tokens.durations[step.duration.token] ?? tokens.durations.base ?? 250);
    let easing = step.easing;
    if (easing.type === 'token') {
      const value = tokens.easings[easing.name] ?? tokens.easings.standard;
      easing = value && value.type !== 'token' ? { ...value } : STANDARD;
    }
    return { ...step, duration, easing };
  });
  return { ...animation, sequence: { ...animation.sequence, steps } };
}

// --- Descriptions used in comments ----------------------------------------------------

const TRIGGER_TEXT: Record<TriggerType, string> = {
  hover: 'plays on hover or keyboard focus, and plays back when that ends',
  click: 'plays on click',
  toggle: 'each click moves it to its other state',
  loop: 'loops while it is on screen',
  appear: 'plays once, the first time it is on screen',
  manual: 'plays only when your code calls play()',
};

const REDUCED_TEXT: Record<Animation['reducedMotion']['mode'], string> = {
  instant: 'it jumps to each state without moving',
  fade: 'it cross-fades between states instead of moving',
  none: 'it stays still on its first state',
};

/** "Trigger: click, plays on click." */
export function triggerSummary(animation: Animation): string {
  return `Trigger: ${animation.trigger.type}, ${TRIGGER_TEXT[animation.trigger.type]}.`;
}

/** "Reduced motion: when the OS asks for less motion, it jumps …" */
export function reducedMotionSummary(animation: Animation): string {
  return `Reduced motion: when the OS asks for less motion, ${REDUCED_TEXT[animation.reducedMotion.mode]}.`;
}

// --- JSON -------------------------------------------------------------------------------

/**
 * The animation as readable JSON. `animation` is ready for the runtime:
 * `createPlayer(svg, data.animation)`.
 */
export function exportJson(animation: Animation, tokens: MotionTokens): ExportFile {
  const data = { schemaVersion: SCHEMA_VERSION, animation: resolveTokens(animation, tokens) };
  return {
    fileName: `${exportFileBase(animation)}.json`,
    type: 'application/json',
    text: `${printData(data, { syntax: 'json' })}\n`,
  };
}

// --- HTML (SVG + runtime) ---------------------------------------------------------------

export interface HtmlExportOptions {
  /** The runtime as a classic script that defines `IconTween` (the runtime's `iife` build). */
  runtime: string;
  /** Icon size on the page, in pixels. Default 48. */
  size?: number;
}

/** Whether the trigger is something a person does, so the icon sits in a button. */
const isInteractive = (t: TriggerType) => t === 'hover' || t === 'click' || t === 'toggle';

/**
 * A complete HTML page: the icon as inline SVG (state A, so it shows before the script
 * runs), the runtime inline, and the animation data with the call that starts it. Works
 * when opened from disk; to use it in a site, copy the <svg> and the two scripts.
 */
export function exportHtml(
  animation: Animation,
  tokens: MotionTokens,
  options: HtmlExportOptions,
): ExportFile {
  const data = resolveTokens(animation, tokens);
  const base = exportFileBase(animation);
  const variable = dataVariableName(animation);
  const id = `${base}-icon`;
  const name = commentText(animation.name) || 'Icon';
  const trigger = animation.trigger.type;
  const size = options.size ?? 48;

  const svg = svgMarkup(data, id, size, '      ');
  const body: string[] = [];
  if (isInteractive(trigger)) {
    body.push(
      `    <button type="button" class="icon-button" id="${id}-button" aria-label="${escapeHtml(name)}">`,
      svg,
      '    </button>',
    );
  } else {
    body.push(svg.replace(/^ {2}/gm, ''));
    if (trigger === 'manual') {
      body.push(`    <button type="button" class="play-button" id="${id}-play">Play</button>`);
    }
  }

  const start: string[] = [];
  const call = `IconTween.createPlayer(document.getElementById('${id}'), ${variable}`;
  if (isInteractive(trigger)) {
    start.push(
      `      // The button listens, so the whole button is the target, not only the strokes.`,
      `      ${call}, {`,
      `        listenOn: document.getElementById('${id}-button'),`,
      `      });`,
    );
  } else if (trigger === 'manual') {
    start.push(
      `      const player = ${call});`,
      `      document.getElementById('${id}-play').addEventListener('click', () => player.play());`,
    );
  } else {
    start.push(`      ${call});`);
  }

  const text = [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${escapeHtml(name)}</title>`,
    '    <style>',
    '      :root {',
    '        color-scheme: light dark;',
    '        font-family: system-ui, sans-serif;',
    '      }',
    '      body {',
    '        display: grid;',
    '        place-content: center;',
    '        justify-items: center;',
    '        gap: 16px;',
    '        min-height: 100vh;',
    '        margin: 0;',
    '      }',
    '      .icon-button {',
    '        display: grid;',
    '        padding: 12px;',
    '        border: 0;',
    '        border-radius: 12px;',
    '        background: none;',
    '        color: inherit;',
    '        cursor: pointer;',
    '      }',
    '    </style>',
    '  </head>',
    '  <body>',
    `    <!-- ${name}, made with IconTween (https://icontween.com). -->`,
    `    <!-- ${capitalise(TRIGGER_TEXT[trigger])}. -->`,
    ...body,
    '',
    '    <!-- The IconTween runtime. One copy is enough for every icon on a page. -->',
    '    <script>',
    // A literal "</script" would end the element early; nothing in the runtime needs it.
    indentLines(options.runtime.trimEnd().replace(/<\/(script)/gi, '<\\/$1'), '      '),
    '    </script>',
    '',
    '    <script>',
    `      // ${name.replace(/<\//g, '<\\/')}: the animation data. Coordinates are in the icon's viewBox.`,
    `      const ${variable} = ${printData(data, { syntax: 'js', indent: '      ', inScript: true })};`,
    '',
    `      // ${reducedMotionSummary(animation)}`,
    ...start,
    '    </script>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');

  return { fileName: `${base}.html`, type: 'text/html', text };
}

/** The icon's <svg> in state A, with each path tagged for the runtime. */
function svgMarkup(animation: Animation, id: string, size: number, indent: string): string {
  const stateA = animation.states[0]!.elements;
  const viewBox = animation.viewBox.map((n) => formatNumber(n)).join(' ');
  const lines = [
    `${indent}<svg`,
    `${indent}  id="${id}"`,
    `${indent}  xmlns="http://www.w3.org/2000/svg"`,
    `${indent}  viewBox="${viewBox}"`,
    `${indent}  width="${size}"`,
    `${indent}  height="${size}"`,
    `${indent}  aria-hidden="true"`,
    `${indent}>`,
  ];
  for (const el of animation.elements) {
    const attrs: [string, string][] = [
      [EXPORT_ELEMENT_ATTRIBUTE, el.id],
      ...pathAttributes(el, stateA[el.id]!),
    ];
    lines.push(`${indent}  <path`);
    for (const [k, v] of attrs) lines.push(`${indent}    ${k}="${escapeHtml(v)}"`);
    lines.push(`${indent}  />`);
  }
  lines.push(`${indent}</svg>`);
  return lines.join('\n');
}

// --- React ------------------------------------------------------------------------------

/** SVG attribute → JSX prop. */
const JSX_PROPS: Record<string, string> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
};
/** Props written as numbers in JSX. */
const NUMERIC_PROPS = new Set(['strokeWidth', 'opacity', 'pathLength', 'strokeDashoffset']);

/**
 * A typed React component (TSX). It renders state A as plain JSX (so it shows during
 * server rendering), and starts the runtime in an effect. Controls through `ref`.
 */
export function exportReact(animation: Animation, tokens: MotionTokens): ExportFile {
  const data = resolveTokens(animation, tokens);
  const component = componentName(animation);
  const name = commentText(animation.name) || component;
  const stateA = data.states[0]!.elements;
  const stateIds = data.states.map((s) => printData(s.id, { syntax: 'js' })).join(' | ');
  const trigger = animation.trigger.type;
  const viewBox = data.viewBox.map((n) => formatNumber(n)).join(' ');

  const paths = data.elements.flatMap((el) => {
    const props = [
      `${EXPORT_ELEMENT_ATTRIBUTE}="${escapeHtml(el.id)}"`,
      ...pathAttributes(el, stateA[el.id]!).map(([k, v]) => {
        const prop = JSX_PROPS[k] ?? k;
        const numeric = NUMERIC_PROPS.has(prop) && /^-?[\d.]+$/.test(v);
        return numeric ? `${prop}={${v}}` : `${prop}="${escapeHtml(v)}"`;
      }),
    ];
    return ['        <path', ...props.map((p) => `          ${p}`), '        />'];
  });

  const usage = isInteractive(trigger)
    ? [
        ' * Usage, inside a button so the whole button is the target:',
        ' *   const button = useRef<HTMLButtonElement>(null);',
        ` *   <button ref={button} type="button" aria-label="${name}">`,
        ` *     <${component} listenOn={button} />`,
        ' *   </button>',
      ]
    : trigger === 'manual'
      ? [
          ' * Usage:',
          ` *   const icon = useRef<${component}Handle>(null);`,
          ` *   <${component} ref={icon} />`,
          ' *   icon.current?.play();',
        ]
      : [' * Usage:', ` *   <${component} />`];

  const text = [
    '/**',
    ` * ${name}, an animated icon made with IconTween (https://icontween.com).`,
    ' *',
    ` * ${triggerSummary(animation)}`,
    ` * ${reducedMotionSummary(animation)}`,
    ' *',
    ` * Needs the IconTween runtime next to this file: icontween.js and icontween.d.ts.`,
    ' *',
    ...usage,
    ' */',
    "import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';",
    "import type { RefObject, SVGProps } from 'react';",
    `import { createPlayer } from '${RUNTIME_MODULE}';`,
    `import type { Animation, Player, PlayerOptions } from '${RUNTIME_MODULE}';`,
    '',
    `const animation: Animation = ${printData(data, { syntax: 'js' })};`,
    '',
    `/** Plays the icon from code, through \`ref\`. */`,
    `export interface ${component}Handle {`,
    '  play(): void;',
    '  reverse(): void;',
    '  toggle(): void;',
    '  stop(): void;',
    '  /** Jumps to a state without animating. */',
    `  setState(state: ${stateIds}): void;`,
    '}',
    '',
    `export interface ${component}Props extends Omit<SVGProps<SVGSVGElement>, 'ref'> {`,
    '  /** Width and height. Default 24. */',
    '  size?: number | string;',
    `  /** What starts the animation. Default '${trigger}'. 'manual' plays only through \`ref\`. */`,
    `  trigger?: PlayerOptions['trigger'];`,
    '  /** Element that listens for the trigger, such as the button around the icon. Default: the icon. */',
    '  listenOn?: RefObject<Element | null>;',
    "  /** 'auto' (default) follows the OS setting, prefers-reduced-motion. */",
    `  reducedMotion?: PlayerOptions['reducedMotion'];`,
    '}',
    '',
    `export const ${component} = forwardRef<${component}Handle, ${component}Props>(function ${component}(`,
    '  { size = 24, trigger, listenOn, reducedMotion, ...props },',
    '  ref,',
    ') {',
    '  const svg = useRef<SVGSVGElement>(null);',
    '  const player = useRef<Player | null>(null);',
    '',
    '  useEffect(() => {',
    '    if (!svg.current) return;',
    '    const current = createPlayer(svg.current, animation, {',
    '      trigger,',
    '      listenOn: listenOn?.current ?? undefined,',
    '      reducedMotion,',
    '    });',
    '    player.current = current;',
    '    return () => {',
    '      current.destroy();',
    '      player.current = null;',
    '    };',
    '  }, [trigger, listenOn, reducedMotion]);',
    '',
    '  useImperativeHandle(',
    '    ref,',
    '    () => ({',
    '      play: () => player.current?.play(),',
    '      reverse: () => player.current?.reverse(),',
    '      toggle: () => player.current?.toggle(),',
    '      stop: () => player.current?.stop(),',
    '      setState: (state) => player.current?.setState(state),',
    '    }),',
    '    [],',
    '  );',
    '',
    '  return (',
    '    <svg',
    '      ref={svg}',
    '      xmlns="http://www.w3.org/2000/svg"',
    `      viewBox="${viewBox}"`,
    '      width={size}',
    '      height={size}',
    '      aria-hidden="true"',
    '      focusable="false"',
    '      {...props}',
    '    >',
    ...paths.map((line) => line.slice(2)),
    '    </svg>',
    '  );',
    '});',
    '',
  ].join('\n');

  return { fileName: `${component}.tsx`, type: 'text/plain', text };
}

// --- Size -------------------------------------------------------------------------------

export interface ExportSize {
  bytes: number;
  gzipped: number;
}

/** Size of a text file as UTF-8, raw and gzipped (the browser's CompressionStream). */
export async function measureExport(text: string): Promise<ExportSize> {
  const bytes = new TextEncoder().encode(text);
  const gzip = new CompressionStream('gzip');
  const writer = gzip.writable.getWriter();
  void writer.write(bytes);
  void writer.close();
  let gzipped = 0;
  const reader = gzip.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    gzipped += value.byteLength;
  }
  return { bytes: bytes.byteLength, gzipped };
}

/** "1.2 KB", "880 B". */
export function formatBytes(n: number): string {
  return n < 1000 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

// --- Helpers ----------------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function indentLines(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => (line ? indent + line : line))
    .join('\n');
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
