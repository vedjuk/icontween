import { matchPattern, nextStateId, patternTemplates, sequencePath } from '@icontween/core';
import { useEffect } from 'react';
import { Library } from '../library/Library';
import { useLibrary } from '../library/useLibrary';
import '../prepare/prepare.css';
import { STARTER_SOURCES, type SourceIcon } from '../starters';
import { Canvas } from './Canvas';
import './editor.css';
import { Inspector } from './Inspector';
import { useEditor } from './store';

/** Starter opened when the URL names none. */
const DEFAULT_SOURCE = 'lucide-menu';

/**
 * M2 editor: pick an icon, clone state A into B, shape B by dragging points and handles,
 * and try the result live. Work isn't saved yet (M4).
 */
export function EditorPage() {
  const source = useEditor((s) => s.source);
  const animation = useEditor((s) => s.animation);
  const error = useEditor((s) => s.error);

  const open = (icon: SourceIcon) => {
    const current = useEditor.getState().animation;
    if (
      current &&
      current.states.length > 1 &&
      !window.confirm('Open another icon? Your states for this one are not saved yet.')
    ) {
      return;
    }
    useEditor.getState().open(icon);
    // Starters can be linked to; user icons only live in this tab.
    const linkable = STARTER_SOURCES.some((s) => s.id === icon.id);
    history.replaceState(null, '', linkable ? `#${icon.id}` : location.pathname);
  };

  const library = useLibrary(open);
  useUndoKeys();

  useEffect(() => {
    const wanted = location.hash.slice(1) || DEFAULT_SOURCE;
    const icon = STARTER_SOURCES.find((s) => s.id === wanted) ?? STARTER_SOURCES[0];
    if (icon && !useEditor.getState().source) useEditor.getState().open(icon);
  }, []);

  return (
    <div className={`editor${library.dragging ? ' is-dragging' : ''}`} {...library.dropTarget}>
      <header className="prepare-header">
        <a href="/" className="wordmark" aria-label="IconTween home">
          <span className="wordmark-icon">icon</span>
          <span className="wordmark-tween">tween</span>
        </a>
        <span className="prepare-step">Editor</span>
        <a className="header-link" href="/prepare">
          Prepare step
        </a>
        {animation && <UndoButtons />}
        <span className="prepare-privacy">Not saved yet. Nothing is uploaded.</span>
      </header>

      <aside className="prepare-sources" aria-label="Icons">
        <Library library={library} selectedId={source?.id ?? ''} onSelect={open} />
      </aside>

      {animation ? (
        <>
          <main className="editor-main">
            <h1 className="editor-title">{animation.name}</h1>
            <Canvas />
            <StateStrip />
            <SequenceStrip />
          </main>
          <Inspector />
        </>
      ) : (
        <main className="editor-main">
          {error ? (
            <div className="error" role="alert">
              <h1>{source?.label}</h1>
              <p>{error}</p>
            </div>
          ) : (
            <p className="empty">Pick an icon to start.</p>
          )}
        </main>
      )}
    </div>
  );
}

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

function UndoButtons() {
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const { undo, redo } = useEditor.getState();
  return (
    <div className="undo-buttons" role="group" aria-label="History">
      <button
        type="button"
        className="button"
        disabled={!canUndo}
        onClick={undo}
        title={`Undo (${MOD}Z)`}
      >
        Undo
      </button>
      <button
        type="button"
        className="button"
        disabled={!canRedo}
        onClick={redo}
        title={`Redo (${isMac ? '⇧⌘Z' : 'Ctrl+Y'})`}
      >
        Redo
      </button>
    </div>
  );
}

/** Text fields keep the browser's own undo while they have focus. */
const TEXT_FIELD =
  'textarea, [contenteditable], input:not([type=range], [type=checkbox], [type=radio], [type=button])';

/** ⌘Z / Ctrl+Z undoes; ⇧⌘Z, Ctrl+Shift+Z and Ctrl+Y redo. */
function useUndoKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(isMac ? e.metaKey : e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && !isMac);
      if (!isUndo && !isRedo) return;
      if ((e.target as HTMLElement | null)?.closest?.(TEXT_FIELD)) return;
      e.preventDefault();
      if (isUndo) useEditor.getState().undo();
      else useEditor.getState().redo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function StateStrip() {
  const animation = useEditor((s) => s.animation)!;
  const stateId = useEditor((s) => s.stateId);
  const { selectState, addState } = useEditor.getState();
  const last = animation.states[animation.states.length - 1]!;
  const next = nextStateId(animation.states);

  return (
    <div className="state-strip" role="group" aria-label="States">
      <div className="segmented">
        {animation.states.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === stateId}
            onClick={() => selectState(s.id)}
          >
            {s.label ?? s.id}
          </button>
        ))}
      </div>
      <button type="button" className="button" onClick={addState}>
        Clone {last.id} → {next}
      </button>
      {animation.states.length === 1 && (
        <p className="hint">
          State A is the prepared icon. Pick a purpose first (it sets the trigger, timing and
          pattern), then clone A and drag points in the new state.
        </p>
      )}
    </div>
  );
}

/** Triggers that play the sequence back by themselves (on leave, on the second click). */
const REVERSING = new Set(['hover', 'toggle']);

/** The sequence as steps, pattern templates, and adding or removing a step at the end. */
function SequenceStrip() {
  const animation = useEditor((s) => s.animation)!;
  const stepIndex = useEditor((s) => s.stepIndex);
  const { selectStep, setPath, applyPattern } = useEditor.getState();
  const steps = animation.sequence.steps;
  if (animation.states.length < 2) return null;

  const path = sequencePath(animation);
  const templates = patternTemplates(animation.states.map((s) => s.id));
  const pattern = matchPattern(animation);
  const last = path[path.length - 1]!;
  // A new step goes back to the start, or on to B when already there.
  const nextTarget = last === path[0] ? animation.states[1]!.id : path[0]!;
  const returns = path.length > 2 && last === path[0];

  return (
    <div className="sequence-strip" role="group" aria-label="Sequence">
      <div className="sequence-row">
        <span className="sequence-label">Sequence</span>
        <ol className="sequence-steps">
          {steps.map((step, i) => (
            <li key={i}>
              <button
                type="button"
                className="sequence-step"
                aria-pressed={i === stepIndex}
                aria-label={`Step ${i + 1}: ${step.from} to ${step.to}`}
                onClick={() => selectStep(i)}
              >
                {step.from} → {step.to}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="button"
          onClick={() => setPath([...path, nextTarget])}
          title={`Add a step ${last} → ${nextTarget}`}
        >
          + Step
        </button>
        <button
          type="button"
          className="button"
          disabled={steps.length === 0}
          onClick={() => setPath(path.slice(0, -1))}
          title="Remove the last step"
        >
          − Step
        </button>
      </div>
      <div className="sequence-row">
        <span className="sequence-label">Pattern</span>
        <div className="segmented">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={pattern?.id === t.id}
              title={`${t.path.join(' → ')}: ${t.hint}`}
              onClick={() => applyPattern(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <span className="hint">{pattern ? pattern.hint : 'Custom'}</span>
      </div>
      {returns && REVERSING.has(animation.trigger.type) && (
        <p className="hint">
          {animation.trigger.type === 'hover'
            ? 'Hover plays the sequence backwards on leave'
            : 'Toggle plays the sequence backwards on the second click'}
          , so a sequence that returns moves twice. Hold usually fits better.
        </p>
      )}
    </div>
  );
}
