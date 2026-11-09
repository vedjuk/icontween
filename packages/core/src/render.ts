/**
 * Prepared icon → readable SVG markup, for previews and (later) exports.
 * Output is formatted for humans (rule 7): one element per line, attributes in a fixed order.
 */
import { formatNumber, segmentsToD } from './path';
import type { ElementState, PreparedElement, ViewBox } from './schema';

export interface IconToSvgOptions {
  /** Pixel size for width/height. Omit to leave them out (scales to its container). */
  size?: number;
  /** Indentation for child elements. */
  indent?: string;
}

const KEBAB: Record<string, string> = {
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
};

/** Renders one state of a prepared icon as standalone SVG markup. */
export function iconToSvg(
  viewBox: ViewBox,
  elements: readonly PreparedElement[],
  stateElements: Record<string, ElementState>,
  options: IconToSvgOptions = {},
): string {
  const indent = options.indent ?? '  ';
  const size =
    options.size === undefined ? '' : ` width="${options.size}" height="${options.size}"`;
  const lines = elements.map((el) => {
    const es = stateElements[el.id];
    if (!es) throw new Error(`State has no values for element "${el.id}"`);
    const attrs: [string, string][] = [['d', segmentsToD(es.segments)]];
    attrs.push(['fill', el.style.fill], ['stroke', el.style.stroke]);
    for (const key of ['strokeWidth', 'strokeLinecap', 'strokeLinejoin'] as const) {
      attrs.push([KEBAB[key]!, String(el.style[key])]);
    }
    const transform = transformAttribute(es);
    if (transform) attrs.push(['transform', transform]);
    if (es.opacity !== 1) attrs.push(['opacity', formatNumber(es.opacity)]);
    const body = attrs.map(([k, v]) => `${k}="${escape(v)}"`).join(' ');
    return `${indent}<path ${body} />`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.map((n) => formatNumber(n)).join(' ')}"${size}>`,
    ...lines,
    '</svg>',
  ].join('\n');
}

/** SVG transform for an element state, or '' when it's the identity. */
export function transformAttribute(es: ElementState): string {
  const { translateX, translateY, rotate, scale, originX, originY } = es.transform;
  const parts: string[] = [];
  const f = (n: number) => formatNumber(n);
  if (translateX !== 0 || translateY !== 0)
    parts.push(`translate(${f(translateX)} ${f(translateY)})`);
  if (rotate !== 0 || scale !== 1) {
    // Rotate and scale around the pivot.
    parts.push(`translate(${f(originX)} ${f(originY)})`);
    if (rotate !== 0) parts.push(`rotate(${f(rotate)})`);
    if (scale !== 1) parts.push(`scale(${f(scale)})`);
    parts.push(`translate(${f(-originX)} ${f(-originY)})`);
  }
  return parts.join(' ');
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
