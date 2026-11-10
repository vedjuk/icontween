/**
 * Live preview with the runtime that ships in exports (rule 9). Re-created on every edit,
 * so it always plays the current data.
 *
 * Stroke width and background are preview-only: they style the tile the way a host page
 * would (CSS on the paths and the tile), and never touch the animation (decision 011).
 */
import type { Animation } from '@icontween/core';
import { createPlayer } from '@icontween/runtime';
import { useEffect, useRef, type CSSProperties } from 'react';
import { useEditor, type PreviewTheme } from './store';

const SIZES = [48, 24, 16] as const;

const HINTS: Partial<Record<Animation['trigger']['type'], string>> = {
  hover: 'Hover or focus the tile',
  click: 'Click the tile',
  toggle: 'Click the tile to toggle',
  loop: 'Plays while the preview is on screen',
  appear: 'Played once when it came on screen. Edit to replay.',
};

const MOTION_OPTIONS = [
  { id: 'auto', label: 'System', title: 'Follow this computer’s reduced-motion setting' },
  { id: 'reduce', label: 'Reduced', title: 'Preview as someone who asked for reduced motion' },
  { id: 'no-preference', label: 'Full', title: 'Preview with full motion' },
] as const;

/** Common icon-set stroke widths, on a 24-unit grid. */
const STROKE_OPTIONS = [1, 1.5, 2, 2.5] as const;

const THEME_OPTIONS: { id: PreviewTheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

/** The stroke width most stroked elements use, or null for fill-only icons. */
function designedStroke(animation: Animation): number | null {
  const counts = new Map<number, number>();
  for (const el of animation.elements) {
    if (el.style.stroke === 'none' || el.style.strokeWidth <= 0) continue;
    counts.set(el.style.strokeWidth, (counts.get(el.style.strokeWidth) ?? 0) + 1);
  }
  let best: number | null = null;
  for (const [width, n] of counts) if (best === null || n > counts.get(best)!) best = width;
  return best;
}

export function Preview({ animation }: { animation: Animation }) {
  const tokens = useEditor((s) => s.tokens);
  const previewMotion = useEditor((s) => s.previewMotion);
  const previewStroke = useEditor((s) => s.previewStroke);
  const previewTheme = useEditor((s) => s.previewTheme);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const ready = animation.sequence.steps.length > 0;
  const designed = designedStroke(animation);
  // Options are on a 24-unit grid; other viewBoxes scale them so they look the same.
  const unitsPer24 = animation.viewBox[2] / 24;

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    const players = svgRefs.current
      .filter((svg): svg is SVGSVGElement => svg !== null)
      .map((svg) => {
        svg.replaceChildren(); // fresh paths for a fresh icon
        svg.removeAttribute('viewBox');
        return createPlayer(svg, animation, {
          listenOn: button,
          tokens,
          reducedMotion: previewMotion,
        });
      });
    return () => players.forEach((p) => p.destroy());
  }, [animation, tokens, previewMotion]);

  const tileStyle =
    previewStroke === null
      ? undefined
      : ({ '--preview-stroke': previewStroke * unitsPer24 } as CSSProperties);

  return (
    <section className="preview">
      <h2 className="section-title">Preview</h2>
      <button
        ref={buttonRef}
        type="button"
        className="preview-target"
        data-theme={previewTheme}
        data-stroke={previewStroke === null ? undefined : ''}
        style={tileStyle}
        aria-label={`Preview of ${animation.name}`}
      >
        {SIZES.map((size, i) => (
          <span key={size} className="preview-size">
            <svg
              ref={(el) => {
                svgRefs.current[i] = el;
              }}
              width={size}
              height={size}
              aria-hidden="true"
            />
            <span className="preview-size-label" aria-hidden="true">
              {size}
            </span>
          </span>
        ))}
      </button>
      <p className="hint">
        {ready
          ? (HINTS[animation.trigger.type] ?? 'Plays from code only')
          : 'Clone A into a new state to see motion.'}
      </p>
      <div className="preview-options">
        <span className="hint" id="preview-stroke-label">
          Stroke{designed === null ? '' : ` · icon uses ${designed / unitsPer24}`}
        </span>
        <div className="segmented" role="group" aria-labelledby="preview-stroke-label">
          <button
            type="button"
            aria-pressed={previewStroke === null}
            onClick={() => useEditor.getState().setPreviewStroke(null)}
            title="Stroke width as designed"
          >
            Icon
          </button>
          {STROKE_OPTIONS.map((width) => (
            <button
              key={width}
              type="button"
              aria-pressed={previewStroke === width}
              disabled={designed === null}
              onClick={() => useEditor.getState().setPreviewStroke(width)}
              title={
                designed === null
                  ? 'This icon has no strokes'
                  : `Preview with a ${width} stroke, as a page could set it with CSS`
              }
            >
              {width}
            </button>
          ))}
        </div>

        <span className="hint" id="preview-theme-label">
          Background
        </span>
        <div className="segmented" role="group" aria-labelledby="preview-theme-label">
          {THEME_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={previewTheme === o.id}
              onClick={() => useEditor.getState().setPreviewTheme(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <span className="hint" id="preview-motion-label">
          Motion
        </span>
        <div className="segmented" role="group" aria-labelledby="preview-motion-label">
          {MOTION_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={previewMotion === o.id}
              onClick={() => useEditor.getState().setPreviewMotion(o.id)}
              title={o.title}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
