import { nextStateId } from '@icontween/core';
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
          State A is the prepared icon. Clone it, then drag points in the new state.
        </p>
      )}
    </div>
  );
}
