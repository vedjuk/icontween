/**
 * Live preview with the runtime that ships in exports (rule 9). Re-created on every edit,
 * so it always plays the current data.
 */
import type { Animation } from '@icontween/core';
import { createPlayer } from '@icontween/runtime';
import { useEffect, useRef } from 'react';

const HINTS: Partial<Record<Animation['trigger']['type'], string>> = {
  hover: 'Hover or focus the tile',
  click: 'Click the tile',
  toggle: 'Click the tile to toggle',
  loop: 'Plays while the preview is on screen',
  appear: 'Played once when it came on screen. Edit to replay.',
};

export function Preview({ animation }: { animation: Animation }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const ready = animation.sequence.steps.length > 0;

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    const players = svgRefs.current
      .filter((svg): svg is SVGSVGElement => svg !== null)
      .map((svg) => {
        svg.replaceChildren(); // fresh paths for a fresh icon
        svg.removeAttribute('viewBox');
        return createPlayer(svg, animation, { listenOn: button });
      });
    return () => players.forEach((p) => p.destroy());
  }, [animation]);

  return (
    <section className="preview">
      <h2 className="section-title">Preview</h2>
      <button
        ref={buttonRef}
        type="button"
        className="preview-target"
        aria-label={`Preview of ${animation.name}`}
      >
        {[48, 24, 16].map((size, i) => (
          <svg
            key={size}
            ref={(el) => {
              svgRefs.current[i] = el;
            }}
            width={size}
            height={size}
            aria-hidden="true"
          />
        ))}
      </button>
      <p className="hint">
        {ready
          ? (HINTS[animation.trigger.type] ?? 'Plays from code only')
          : 'Clone A into a new state to see motion.'}
      </p>
    </section>
  );
}
