import {
  getPoint,
  pivotPresets,
  type Animation,
  type Easing,
  type Sequence,
  type Transition,
  type TriggerType,
} from '@icontween/core';
import { DEFAULT_TOKENS, resolveMotion } from '@icontween/runtime';
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
  {
    id: 'spring-gentle',
    label: 'Spring · gentle',
    easing: { type: 'token', name: 'spring-gentle' },
  },
  {
    id: 'spring-snappy',
    label: 'Spring · snappy',
    easing: { type: 'token', name: 'spring-snappy' },
  },
  {
    id: 'spring-bouncy',
    label: 'Spring · bouncy',
    easing: { type: 'token', name: 'spring-bouncy' },
  },
];

const TRIGGERS: { id: TriggerType; label: string }[] = [
  { id: 'hover', label: 'Hover' },
  { id: 'click', label: 'Click' },
  { id: 'toggle', label: 'Toggle' },
  { id: 'loop', label: 'Loop (while visible)' },
  { id: 'appear', label: 'Appear (once, on screen)' },
];

const REPEATS: { id: Sequence['repeat']; label: string }[] = [
  { id: 'once', label: 'Once' },
  { id: 'loop', label: 'Loop' },
  { id: 'ping-pong', label: 'Ping-pong' },
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
  const { selectElement, movePoint, setTransition, setTrigger, setRepeat, setSnap, setOnion } =
    useEditor.getState();
  const { repeat, restBetweenLoops = 0 } = animation.sequence;

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

      {elementId && state.elements[elementId] && (
        <ElementValues animation={animation} stateId={stateId} elementId={elementId} />
      )}

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
          {isSpring(step.easing) ? (
            <p className="hint">
              Springs set their own length: about{' '}
              {Math.round(resolveMotion(step.easing, 0, DEFAULT_TOKENS).duration / 10) * 10} ms.
            </p>
          ) : (
            <DurationField step={step} onChange={(duration) => setTransition({ duration })} />
          )}
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
          <div className="field">
            <span>Repeat</span>
            <div className="duration">
              <select
                value={repeat}
                aria-label="Repeat"
                onChange={(e) =>
                  setRepeat(e.target.value as Sequence['repeat'], restBetweenLoops || 600)
                }
              >
                {REPEATS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              {repeat !== 'once' && (
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={50}
                  value={restBetweenLoops}
                  aria-label="Rest between loops in milliseconds"
                  title="Rest between loops (ms)"
                  onChange={(e) => {
                    if (Number.isFinite(e.target.valueAsNumber)) {
                      setRepeat(repeat, e.target.valueAsNumber);
                    }
                  }}
                />
              )}
            </div>
            {repeat === 'once' && animation.trigger.type === 'loop' && (
              <p className="hint">The loop trigger repeats anyway.</p>
            )}
            {repeat !== 'once' && <p className="hint">Rest between loops, in ms.</p>}
          </div>
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

const PIVOT_LABELS = [
  ['top left', 'top', 'top right'],
  ['left', 'centre', 'right'],
  ['bottom left', 'bottom', 'bottom right'],
];

/** Transform, pivot, opacity and draw of the selected element in the edited state. */
function ElementValues({
  animation,
  stateId,
  elementId,
}: {
  animation: Animation;
  stateId: string;
  elementId: string;
}) {
  const { setValues, setPivot, resetValues } = useEditor.getState();
  const es = animation.states.find((s) => s.id === stateId)!.elements[elementId]!;
  const t = es.transform;
  const name = animation.elements.find((e) => e.id === elementId)?.name ?? elementId;
  const isDefault =
    t.translateX === 0 &&
    t.translateY === 0 &&
    t.rotate === 0 &&
    t.scale === 1 &&
    es.opacity === 1 &&
    es.draw.start === 0 &&
    es.draw.end === 1;
  const pct = (n: number) => Math.round(n * 1000) / 10;

  return (
    <section>
      <h2 className="section-title">
        {name} in {stateId}
      </h2>

      <div className="field">
        <span>Move</span>
        <div className="xy">
          <NumberField
            label="X"
            value={t.translateX}
            step={0.1}
            onChange={(v) => setValues({ transform: { translateX: v } })}
          />
          <NumberField
            label="Y"
            value={t.translateY}
            step={0.1}
            onChange={(v) => setValues({ transform: { translateY: v } })}
          />
        </div>
      </div>

      <div className="xy">
        <NumberField
          label="Rotate °"
          value={t.rotate}
          step={1}
          onChange={(v) => setValues({ transform: { rotate: v } })}
        />
        <NumberField
          label="Scale %"
          value={pct(t.scale)}
          step={5}
          onChange={(v) => setValues({ transform: { scale: v / 100 } })}
        />
      </div>

      <div className="field">
        <span>Pivot (all states)</span>
        <div className="pivot">
          <div className="pivot-grid" role="group" aria-label="Pivot presets">
            {pivotPresets(animation, elementId).map((p) => (
              <button
                key={`${p.col}-${p.row}`}
                type="button"
                aria-label={`Pivot ${PIVOT_LABELS[p.row]![p.col]}`}
                aria-pressed={p.x === t.originX && p.y === t.originY}
                onClick={() => setPivot(p.x, p.y)}
              />
            ))}
          </div>
          <div className="pivot-xy">
            <NumberField
              label="X"
              value={t.originX}
              step={0.5}
              onChange={(v) => setPivot(v, t.originY)}
            />
            <NumberField
              label="Y"
              value={t.originY}
              step={0.5}
              onChange={(v) => setPivot(t.originX, v)}
            />
          </div>
        </div>
      </div>

      <RangeField
        label="Opacity"
        value={pct(es.opacity)}
        onChange={(v) => setValues({ opacity: v / 100 })}
      />
      <RangeField
        label="Draw start"
        value={pct(es.draw.start)}
        onChange={(v) => setValues({ draw: { start: v / 100 } })}
      />
      <RangeField
        label="Draw end"
        value={pct(es.draw.end)}
        onChange={(v) => setValues({ draw: { end: v / 100 } })}
      />

      <button type="button" className="button" disabled={isDefault} onClick={resetValues}>
        Reset {name} in {stateId}
      </button>
      <p className="hint">
        Drag the element to move it, the cross to move its pivot. Arrow keys nudge it when no point
        is selected.
      </p>
    </section>
  );
}

function NumberField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field-inline">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          if (Number.isFinite(e.target.valueAsNumber)) onChange(e.target.valueAsNumber);
        }}
      />
    </label>
  );
}

/** A 0–100 % slider with a number field. */
function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (Number.isFinite(e.target.valueAsNumber)) onChange(e.target.valueAsNumber);
  };
  return (
    <div className="field range">
      <span>{label}</span>
      <div className="range-row">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={label}
          onChange={change}
        />
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-label={`${label} in percent`}
          onChange={change}
        />
        <span className="range-unit">%</span>
      </div>
    </div>
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

/** True for spring easings, given directly or as a token. */
function isSpring(easing: Easing): boolean {
  const e = easing.type === 'token' ? DEFAULT_TOKENS.easings[easing.name] : easing;
  return e?.type === 'spring';
}
