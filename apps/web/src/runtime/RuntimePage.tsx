import type { Animation, Easing, TriggerType } from '@icontween/core';
import { createPlayer, type Player, type ReducedMotionPreference } from '@icontween/runtime';
import { useEffect, useMemo, useRef, useState } from 'react';
import '../prepare/prepare.css';
import { DEMOS } from './demos';
import './runtime.css';

const EASINGS: { id: string; label: string; easing: Easing }[] = [
  { id: 'standard', label: 'standard', easing: { type: 'token', name: 'standard' } },
  { id: 'snappy', label: 'snappy', easing: { type: 'token', name: 'snappy' } },
  {
    id: 'ease-in-out',
    label: 'ease-in-out',
    easing: { type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  },
  { id: 'linear', label: 'linear', easing: { type: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 } },
];

const TRIGGERS: TriggerType[] = ['hover', 'toggle', 'click', 'manual'];
const PREFERENCES: ReducedMotionPreference[] = ['auto', 'no-preference', 'reduce'];
const RM_MODES = ['instant', 'fade', 'none'] as const;

/**
 * Developer playground for the runtime (M2 part 1). Plays hand-built demos with the same
 * runtime the editor and exports use, so timing and interruption can be judged by hand.
 */
export function RuntimePage() {
  const [demoId, setDemoId] = useState(DEMOS[0]!.id);
  const [trigger, setTrigger] = useState<TriggerType>('hover');
  const [duration, setDuration] = useState(250);
  const [easingId, setEasingId] = useState('standard');
  const [preference, setPreference] = useState<ReducedMotionPreference>('auto');
  const [rmMode, setRmMode] = useState<(typeof RM_MODES)[number]>('instant');

  const demo = DEMOS.find((d) => d.id === demoId) ?? DEMOS[0]!;
  const animation = useMemo<Animation>(() => {
    const step = demo.animation.sequence.steps[0]!;
    const easing = EASINGS.find((e) => e.id === easingId)!.easing;
    return {
      ...demo.animation,
      sequence: { ...demo.animation.sequence, steps: [{ ...step, duration, easing }] },
      trigger: { type: trigger },
      reducedMotion: { mode: rmMode },
    };
  }, [demo, duration, easingId, trigger, rmMode]);

  return (
    <div className="runtime">
      <header className="prepare-header">
        <a href="/" className="wordmark" aria-label="IconTween home">
          <span className="wordmark-icon">icon</span>
          <span className="wordmark-tween">tween</span>
        </a>
        <span className="prepare-step">Runtime playground</span>
        <span className="prepare-privacy">Hand-built demos. The editor arrives in M2 part 2.</span>
      </header>

      <main className="runtime-main">
        <Stage key={demo.id} animation={animation} preference={preference} />

        <form className="runtime-controls" onSubmit={(e) => e.preventDefault()}>
          <Choice
            label="Demo"
            value={demoId}
            options={DEMOS.map((d) => [d.id, d.label])}
            onChange={setDemoId}
          />
          <Choice
            label="Trigger"
            value={trigger}
            options={TRIGGERS.map((t) => [t, t])}
            onChange={(v) => setTrigger(v as TriggerType)}
          />
          <label className="field">
            <span className="section-title">Duration {duration} ms</span>
            <input
              type="range"
              min={50}
              max={2000}
              step={10}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
          <Choice
            label="Easing"
            value={easingId}
            options={EASINGS.map((e) => [e.id, e.label])}
            onChange={setEasingId}
          />
          <Choice
            label="Reduced motion (preview)"
            value={preference}
            options={PREFERENCES.map((p) => [p, p])}
            onChange={(v) => setPreference(v as ReducedMotionPreference)}
          />
          <Choice
            label="Reduced-motion variant"
            value={rmMode}
            options={RM_MODES.map((m) => [m, m])}
            onChange={(v) => setRmMode(v as (typeof RM_MODES)[number])}
          />
        </form>
      </main>
    </div>
  );
}

/** The icon at 160px and 24px. Both players listen on the same button, like a real UI. */
function Stage({
  animation,
  preference,
}: {
  animation: Animation;
  preference: ReducedMotionPreference;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bigRef = useRef<SVGSVGElement>(null);
  const smallRef = useRef<SVGSVGElement>(null);
  const players = useRef<Player[]>([]);

  useEffect(() => {
    const button = buttonRef.current!;
    const created = [bigRef.current!, smallRef.current!].map((svg) =>
      createPlayer(svg, animation, { listenOn: button, reducedMotion: preference }),
    );
    players.current = created;
    return () => created.forEach((p) => p.destroy());
  }, [animation, preference]);

  return (
    <div className="stage">
      <button
        ref={buttonRef}
        type="button"
        className="stage-target"
        aria-label={`${animation.name} demo`}
      >
        <svg ref={bigRef} width={160} height={160} aria-hidden="true" />
        <svg ref={smallRef} width={24} height={24} aria-hidden="true" />
      </button>
      <p className="hint">
        {animation.trigger.type === 'hover'
          ? 'Hover or focus the tile. Move in and out quickly to test interruption.'
          : animation.trigger.type === 'manual'
            ? 'Use the buttons below.'
            : 'Click the tile.'}
      </p>
      <div className="segmented" role="group" aria-label="Playback">
        <button type="button" onClick={() => players.current.forEach((p) => p.play())}>
          Play
        </button>
        <button type="button" onClick={() => players.current.forEach((p) => p.reverse())}>
          Reverse
        </button>
        <button type="button" onClick={() => players.current.forEach((p) => p.toggle())}>
          Toggle
        </button>
        <button type="button" onClick={() => players.current.forEach((p) => p.stop())}>
          Stop
        </button>
      </div>
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="section-title">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}
