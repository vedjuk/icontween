/**
 * SVG features the pipeline can't use yet, explained in plain words (decision 020).
 *
 * The sanitizer drops these elements together with their children, so a gradient inside
 * <defs> is only reported as "defs". This module looks at the whole tree before
 * sanitizing, so the designer hears about the gradient, and what to do about it.
 */

/** A feature the designer would recognise, not an element name. */
export type UnsupportedFeature =
  | 'text'
  | 'clipping'
  | 'gradient'
  | 'pattern'
  | 'filter'
  | 'symbol'
  | 'image'
  | 'stylesheet'
  | 'marker'
  | 'nested-svg'
  | 'link'
  | 'switch';

/** Element name → the feature it belongs to. <defs> by itself is harmless and not listed. */
const ELEMENT_FEATURE: Record<string, UnsupportedFeature> = {
  text: 'text',
  tspan: 'text',
  textPath: 'text',
  clipPath: 'clipping',
  mask: 'clipping',
  linearGradient: 'gradient',
  radialGradient: 'gradient',
  pattern: 'pattern',
  filter: 'filter',
  use: 'symbol',
  symbol: 'symbol',
  image: 'image',
  style: 'stylesheet',
  marker: 'marker',
  svg: 'nested-svg',
  a: 'link',
  switch: 'switch',
};

/** What the feature is, what happened to it, and what to do instead. */
export const UNSUPPORTED_HELP: Record<UnsupportedFeature, { title: string; message: string }> = {
  text: {
    title: 'Text',
    message: 'Text isn’t supported, so it was left out. Convert text to outlines first.',
  },
  clipping: {
    title: 'Masks and clipping',
    message:
      'Masks and clipping paths aren’t supported, so shapes show uncut. Flatten or release the mask first.',
  },
  gradient: {
    title: 'Gradients',
    message:
      'Gradients aren’t supported. Shapes that used one lost that colour; use a flat colour.',
  },
  pattern: {
    title: 'Patterns',
    message: 'Pattern fills aren’t supported. Shapes that used one lost that fill.',
  },
  filter: {
    title: 'Filters',
    message: 'Filters (shadows, blurs) aren’t supported, so they were left out.',
  },
  symbol: {
    title: 'Reused symbols',
    message:
      'Symbols placed with <use> aren’t supported, so those copies were left out. Detach or expand them first.',
  },
  image: {
    title: 'Embedded images',
    message: 'Embedded images were left out. Only vector shapes can animate.',
  },
  stylesheet: {
    title: 'Style block',
    message:
      'CSS in a <style> block is ignored, so colours and strokes set there are lost. Export with presentation attributes instead.',
  },
  marker: {
    title: 'Markers',
    message: 'Markers (like arrowheads on a line) aren’t supported. Draw them as shapes.',
  },
  'nested-svg': {
    title: 'Nested SVG',
    message: 'An <svg> inside the SVG isn’t supported, so its shapes were left out.',
  },
  link: {
    title: 'Links',
    message: 'Shapes inside a link (<a>) were left out. Remove the link around them.',
  },
  switch: {
    title: 'Switch',
    message: 'Shapes inside a <switch> were left out. Ungroup them first.',
  },
};

export interface UnsupportedItem {
  feature: UnsupportedFeature;
  /** Elements of this feature in the source, nested ones included. */
  count: number;
}

/** Counts unsupported features under `root` (the root <svg> itself isn't counted). */
export function findUnsupported(root: Element): UnsupportedItem[] {
  const counts = new Map<UnsupportedFeature, number>();
  for (const el of root.getElementsByTagName('*')) {
    const feature = featureOf(el.localName);
    if (feature) counts.set(feature, (counts.get(feature) ?? 0) + 1);
  }
  return [...counts].map(([feature, count]) => ({ feature, count }));
}

/** True for elements the sanitizer drops because they're unsupported, not unsafe. */
export function isUnsupportedElement(name: string): boolean {
  return featureOf(name) !== undefined || name === 'defs';
}

/** Own keys only: an element named "constructor" isn't a feature. */
function featureOf(name: string): UnsupportedFeature | undefined {
  return Object.hasOwn(ELEMENT_FEATURE, name) ? ELEMENT_FEATURE[name] : undefined;
}

/** Attributes that only point at an unsupported feature; never kept, never a safety issue. */
const REFERENCE_ATTRIBUTES = new Set([
  'clip-path',
  'mask',
  'filter',
  'marker-start',
  'marker-mid',
  'marker-end',
]);

export function isReferenceAttribute(name: string): boolean {
  return REFERENCE_ATTRIBUTES.has(name);
}
