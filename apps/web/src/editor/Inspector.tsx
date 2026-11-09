import { getPoint, type Easing, type Transition, type TriggerType } from '@icontween/core';
import { DEFAULT_TOKENS } from '@icontween/runtime';
import { Preview } from './Preview';
import { useEditor } from './store';

const ROLE_LABEL = { anchor: 'Point', c1: 'Handle (out)', c2: 'Handle (in)' } as const;

const EASINGS: { id: string; label: string; easing: Easing }[] = [
  { id: 'standard', label: 'Standard', easing: { type: 'token', name: 'standard' } },
  { id: 'snappy', label: 'Snappy', easing: { type: 'token', name: 'snappy' } },
  {
    id: 'ease-in-out',
    label: 'Ease in-out',
    easing: { type: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  },
  { id: 'linear', label: 'Linear', easing: { type: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 } },
];

/** Triggers the runtime supports so far (loop and appear arrive in M3). */
const TRIGGERS: { id: TriggerType; label: string }[] = [
  { id: 'hover', label: 'Hover' },
  { id: 'click', label: 'Click' },
  { id: 'toggle', label: 'Toggle' },
];

const easingId = (e: Easing) =>
  EASINGS.find((o) => JSON.stringify(o.easing) === JSON.stringify(e))?.id ?? 'standard';

export function Inspector() {
  const animation = useEditor((s) => s.animation)!;
  const stateId = useEditor((s) => s.stateId);
  const elementId = useEditor((s) => s.elementId);
  const point = useEditor((s) => s.point);
  const snap = useEditor((s) => s.snap);
  const onion = useEditor((s) => s.onion);
  const { selectElement, movePoint, setTransition, setTrigger, setSnap, setOnion } =
    useEditor.getState();

  const state = animation.states.find((s) => s.id === stateId)!;
  const step = animation.sequence.steps.find((s) => s.to === stateId);
  const segments = elementId ? state.elements[elementId]?.segments : undefined;
  const at = point && segments ? getPoint(segments, point) : null;

  return (
    <aside className="inspector" aria-label="Inspector">
      <Preview animation={animation} />

      <section>
        <h2 className="section-title">Elements</h2>
        <ul className="icon-list">
          {animation.elements.map((el) => (
            <li key={el.id}>
              <button
                type="button"
                className="icon-item"
                aria-current={el.id === elementId ? 'true' : undefined}
                onClick={() => selectElement(el.id)}
              >
                {el.name ?? el.id}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {point && at && (
        <section>
          <h2 className="section-title">{ROLE_LABEL[point.role]}</h2>
          <div className="xy">
            {(['x', 'y'] as const).map((axis) => (
              <label key={axis} className="field-inline">
                <span>{axis.toUpperCase()}</span>
                <input
                  type="number"
                  step={0.1}
                  value={at[axis]}
                  onChange={(e) => {
                    const v = e.target.valueAsNumber;
                    if (!Number.isFinite(v)) return;
                    movePoint(point, axis === 'x' ? v : at.x, axis === 'y' ? v : at.y);
                  }}
                />
              </label>
            ))}
          </div>
          <p className="hint">Arrow keys nudge 0.1, Shift + arrow 1.</p>
        </section>
      )}

      {step && (
        <section>
          <h2 className="section-title">
            Transition {step.from} → {step.to}
          </h2>
          <DurationField step={step} onChange={(duration) => setTransition({ duration })} />
          <label className="field">
            <span>Easing</span>
            <select
              value={easingId(step.easing)}
              onChange={(e) =>
                setTransition({ easing: EASINGS.find((o) => o.id === e.target.value)!.easing })
              }
            >
              {EASINGS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      {animation.sequence.steps.length > 0 && (
        <section>
          <label className="field">
            <span className="section-title">Trigger</span>
            <select
              value={animation.trigger.type}
              onChange={(e) => setTrigger(e.target.value as TriggerType)}
            >
              {TRIGGERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}

      <section>
        <h2 className="section-title">View</h2>
        <label className="checkbox">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          Snap to half grid (hold Alt to skip)
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={onion} onChange={(e) => setOnion(e.target.checked)} />
          Onion skin (previous state)
        </label>
      </section>
    </aside>
  );
}

function DurationField({
  step,
  onChange,
}: {
  step: Transition;
  onChange: (duration: Transition['duration']) => void;
}) {
  const tokens = DEFAULT_TOKENS.durations;
  const token = typeof step.duration === 'number' ? 'custom' : step.duration.token;
  const ms =
    typeof step.duration === 'number' ? step.duration : (tokens[step.duration.token] ?? 250);
  return (
    <div className="field">
      <span>Duration</span>
      <div className="duration">
        <select
          value={token}
          onChange={(e) => onChange(e.target.value === 'custom' ? ms : { token: e.target.value })}
        >
          {Object.entries(tokens).map(([name, value]) => (
            <option key={name} value={name}>
              {name} · {value} ms
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
        {token === 'custom' && (
          <input
            type="number"
            min={0}
            max={5000}
            step={10}
            value={ms}
            aria-label="Duration in milliseconds"
            onChange={(e) => {
              if (Number.isFinite(e.target.valueAsNumber)) onChange(e.target.valueAsNumber);
            }}
          />
        )}
      </div>
    </div>
  );
}
