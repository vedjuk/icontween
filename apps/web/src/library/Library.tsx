/**
 * The icon library sidebar: add SVG files, paste code, drop files anywhere on the page,
 * and pick from your icons or the starter set. Shared by the prepare screen and the editor.
 */
import { useEffect, useRef, useState } from 'react';
import { MaskedSvg } from '../prepare/MaskedSvg';
import { STARTER_SOURCES, type SourceIcon } from '../starters';
import { checkIcon } from './iconCheck';
import { importAnnouncement, importSummary } from './importSummary';
import { useLibraryStore, type ImportResult } from './libraryStore';
import { deleteIcon, renameIcon } from './manage';
import type { useLibrary } from './useLibrary';
import { focusFirst, focusIsLost } from '../ui/focus';

type LibraryApi = ReturnType<typeof useLibrary>;

export function Library({
  library,
  selectedId,
  onSelect,
  editedIds = {},
}: {
  library: LibraryApi;
  selectedId: string;
  onSelect: (icon: SourceIcon) => void;
  /** Icons that have an animation in the project get a dot. */
  editedIds?: Record<string, unknown>;
}) {
  const [pasted, setPasted] = useState('');
  const { userIcons, addPasted } = library;
  return (
    <>
      <section className="add-icons">
        <FilePicker library={library}>Add SVG files</FilePicker>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pasted.trim()) return;
            // Code that doesn't work stays in the box, so it can be fixed.
            if (addPasted(pasted) > 0) setPasted('');
          }}
        >
          <label htmlFor="paste" className="visually-hidden">
            SVG code
          </label>
          <textarea
            id="paste"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'<svg viewBox="0 0 24 24">…</svg>'}
            spellCheck={false}
            rows={3}
          />
          <button type="submit" className="button">
            Use pasted code
          </button>
        </form>
        <p className="hint">Or drop SVG files anywhere on the page. Several at once is fine.</p>
      </section>

      <ImportAnnouncer />
      <ImportReport onSelect={onSelect} icons={userIcons} />

      {userIcons.length > 0 && (
        <IconList
          id="yours"
          title="Your icons"
          editable
          icons={userIcons}
          selectedId={selectedId}
          onSelect={onSelect}
          editedIds={editedIds}
        />
      )}
      <IconList
        id="starters"
        title="Starter set (Lucide)"
        // Once you have icons of your own, they come first and the starters fold away.
        defaultOpen={userIcons.length === 0}
        icons={STARTER_SOURCES}
        selectedId={selectedId}
        onSelect={onSelect}
        editedIds={editedIds}
      />
    </>
  );
}

/** A button that opens the file picker; any number of SVG files. */
export function FilePicker({
  library,
  className = 'button file-button',
  children,
}: {
  library: LibraryApi;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      {children}
      <input
        type="file"
        accept=".svg,image/svg+xml"
        multiple
        onChange={(e) => {
          if (e.target.files) void library.addFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </label>
  );
}

/**
 * Says what an import did. A live region only speaks when its text changes, and one that
 * appears together with its text is often missed, so this one is always in the page.
 */
function ImportAnnouncer() {
  const results = useLibraryStore((s) => s.lastImport);
  return (
    <p className="visually-hidden" role="status">
      {results ? importAnnouncement(results) : ''}
    </p>
  );
}

/** What the last drop, pick or paste did, file by file, until dismissed. */
function ImportReport({
  icons,
  onSelect,
}: {
  icons: SourceIcon[];
  onSelect: (icon: SourceIcon) => void;
}) {
  const results = useLibraryStore((s) => s.lastImport);
  if (!results) return null;
  const summary = importSummary(results);

  return (
    <section className="import-report" aria-label="Import result">
      <div className="import-report-header">
        <h2 className="section-title">{summary}</h2>
        <button
          type="button"
          className="link-button"
          onClick={() => useLibraryStore.getState().setImport(null)}
        >
          Dismiss
        </button>
      </div>
      <ul>
        {results.map((r, i) => (
          <ImportRow
            key={i}
            result={r}
            open={results.length === 1}
            icon={r.status === 'added' ? icons.find((icon) => icon.id === r.iconId) : undefined}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}

function ImportRow({
  result,
  open,
  icon,
  onSelect,
}: {
  result: ImportResult;
  open: boolean;
  icon?: SourceIcon;
  onSelect: (icon: SourceIcon) => void;
}) {
  const name = icon ? (
    <button type="button" className="link-button import-name" onClick={() => onSelect(icon)}>
      {result.name}
    </button>
  ) : (
    <span className="import-name">{result.name}</span>
  );

  if (result.status === 'failed') {
    return (
      <li className="import-failed">
        <span className="import-mark" aria-hidden="true">
          ✕
        </span>
        <div>
          {name} <span className="visually-hidden">not added:</span>
          <p>{result.error}</p>
        </div>
      </li>
    );
  }
  const { notes } = result;
  return (
    <li className={notes.length ? 'import-notes' : 'import-added'}>
      <span className="import-mark" aria-hidden="true">
        {notes.length ? '!' : '✓'}
      </span>
      <div>
        {name}{' '}
        {notes.length === 0 ? (
          <span className="muted">added</span>
        ) : (
          <details open={open}>
            <summary>
              added, {notes.length === 1 ? '1 thing to know' : `${notes.length} things to know`}
            </summary>
            <ul>
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}

function IconList({
  id,
  title,
  icons,
  selectedId,
  onSelect,
  editedIds,
  editable = false,
  defaultOpen = true,
}: {
  /** Key for remembering whether the section is open. */
  id: string;
  title: string;
  icons: SourceIcon[];
  selectedId: string;
  onSelect: (icon: SourceIcon) => void;
  editedIds: Record<string, unknown>;
  /** Your own icons can be renamed and deleted; starters can't. */
  editable?: boolean;
  /** Until the person opens or closes it themselves. */
  defaultOpen?: boolean;
}) {
  const [stored, setStored] = useState(() => readOpen(id));
  const open = stored ?? defaultOpen;
  return (
    <details
      className="icon-section"
      open={open}
      onToggle={(e) => {
        const now = e.currentTarget.open;
        if (now !== open) {
          setStored(now);
          writeOpen(id, now);
        }
      }}
    >
      <summary className="section-title">
        {title} <span className="count">{icons.length}</span>
      </summary>
      <ul className="icon-list">
        {icons.map((icon) => (
          <IconRow
            key={icon.id}
            icon={icon}
            selected={icon.id === selectedId}
            edited={icon.id in editedIds}
            editable={editable}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </details>
  );
}

function IconRow({
  icon,
  selected,
  edited,
  editable,
  onSelect,
}: {
  icon: SourceIcon;
  selected: boolean;
  edited: boolean;
  editable: boolean;
  onSelect: (icon: SourceIcon) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const itemRef = useRef<HTMLButtonElement>(null);
  const wasRenaming = useRef(false);
  // After renaming (Enter or Esc), focus goes back to the row instead of the page. Leaving the
  // field by clicking elsewhere keeps focus where the click put it.
  useEffect(() => {
    if (!renaming && wasRenaming.current && focusIsLost()) focusFirst(itemRef.current);
    wasRenaming.current = renaming;
  }, [renaming]);
  const check = checkIcon(icon.svg);
  const problem = check.ok
    ? check.notes.length > 0
      ? `${check.notes.length === 1 ? '1 thing' : `${check.notes.length} things`} to know:\n${check.notes.join('\n')}`
      : null
    : check.error;

  if (renaming) {
    return (
      <li className="icon-row is-renaming">
        <Thumb svg={check.svg} />
        <RenameField
          label={icon.label}
          onDone={(label) => {
            if (label !== null) renameIcon(icon.id, label);
            setRenaming(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className={`icon-row${selected ? ' is-selected' : ''}`}>
      <button
        ref={itemRef}
        type="button"
        className="icon-item"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(icon)}
        title={problem ?? undefined}
      >
        <Thumb svg={check.svg} />
        <span className="icon-label">{icon.label}</span>
        {problem && (
          <span className={`icon-flag${check.ok ? '' : ' is-error'}`}>
            {check.ok ? '!' : '✕'}
            <span className="visually-hidden">
              {check.ok ? ' (has notes)' : ' (can’t be opened)'}
            </span>
          </span>
        )}
        {edited && (
          <span className="edited-dot" title="Animated in this project">
            <span className="visually-hidden">(animated)</span>
          </span>
        )}
      </button>
      {editable && (
        <span className="icon-actions">
          <button
            type="button"
            className="icon-action"
            aria-label={`Rename ${icon.label}`}
            title="Rename"
            onClick={() => setRenaming(true)}
          >
            <ActionIcon d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </button>
          <button
            type="button"
            className="icon-action"
            aria-label={`Delete ${icon.label}`}
            title="Delete"
            onClick={(e) => void deleteAndKeepFocus(icon, e.currentTarget)}
          >
            <ActionIcon d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </button>
        </span>
      )}
    </li>
  );
}

/**
 * Deletes after asking, then moves focus to the next icon in the list (or the one before,
 * the section heading, or Add SVG files when it was the last of your icons).
 */
async function deleteAndKeepFocus(icon: SourceIcon, button: HTMLElement) {
  const row = button.closest('li');
  const item = (li: Element | null | undefined) =>
    li?.querySelector<HTMLButtonElement>('.icon-item') ?? null;
  const candidates = [
    item(row?.nextElementSibling),
    item(row?.previousElementSibling),
    row?.closest('details')?.querySelector('summary'),
  ];
  if (!(await deleteIcon(icon))) return;
  requestAnimationFrame(() => {
    if (!focusIsLost()) return;
    focusFirst(...candidates, document.querySelector<HTMLElement>('.add-icons input[type=file]'));
  });
}

/** Open or closed sections are a per-browser convenience: storage may be missing or blocked. */
const OPEN_KEY = 'icontween:library-open:';

function readOpen(id: string): boolean | null {
  try {
    const v = localStorage.getItem(OPEN_KEY + id);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

function writeOpen(id: string, open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY + id, open ? '1' : '0');
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

/** Enter or leaving the field saves, Esc cancels (null). */
function RenameField({ label, onDone }: { label: string; onDone: (label: string | null) => void }) {
  const [value, setValue] = useState(label);
  // Enter unmounts the field, which can also fire blur: finish once.
  const done = useRef(false);
  const finish = (result: string | null) => {
    if (done.current) return;
    done.current = true;
    onDone(result === null || !result.trim() || result.trim() === label ? null : result);
  };
  return (
    <input
      className="rename-field"
      aria-label={`New name for ${label}`}
      value={value}
      autoFocus
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(value);
        if (e.key === 'Escape') finish(null);
      }}
      spellCheck={false}
    />
  );
}

function ActionIcon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

/** The prepared icon, or the sanitized source when it can't be prepared. */
export function Thumb({ svg, size = 20 }: { svg: string | null; size?: number }) {
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      {svg ? <MaskedSvg svg={svg} color="currentColor" size={size} /> : '!'}
    </span>
  );
}
