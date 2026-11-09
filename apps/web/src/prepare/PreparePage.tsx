import {
  describeReport,
  iconToSvg,
  prepareSvg,
  sanitizeSvg,
  type PrepareResult,
} from '@icontween/core';
import { useMemo, useState, type DragEvent } from 'react';
import { STARTER_SOURCES, type SourceIcon } from '../starters';
import { Compare, type CompareMode } from './Compare';
import { MaskedSvg } from './MaskedSvg';
import './prepare.css';

const MODES: { id: CompareMode; label: string }[] = [
  { id: 'overlay', label: 'Overlay' },
  { id: 'difference', label: 'Difference' },
  { id: 'side-by-side', label: 'Side by side' },
];

/**
 * M1 prepare screen: pick or bring an SVG, see the original against the prepared
 * clone, and read the cleanup report. Nothing leaves the browser.
 */
export function PreparePage() {
  const [userIcons, setUserIcons] = useState<SourceIcon[]>([]);
  const [selectedId, setSelectedId] = useState(STARTER_SOURCES[0]?.id ?? '');
  const [mode, setMode] = useState<CompareMode>('overlay');
  const [showGrid, setShowGrid] = useState(true);
  const [pasted, setPasted] = useState('');
  const [dragging, setDragging] = useState(false);

  const all = useMemo(() => [...userIcons, ...STARTER_SOURCES], [userIcons]);
  const selected = all.find((i) => i.id === selectedId);

  const addIcons = (icons: SourceIcon[]) => {
    if (icons.length === 0) return;
    setUserIcons((prev) => [...icons, ...prev]);
    setSelectedId(icons[0]!.id);
  };

  const addFiles = async (files: FileList | File[]) => {
    const svgs = [...files].filter((f) => f.type === 'image/svg+xml' || f.name.endsWith('.svg'));
    const icons = await Promise.all(
      svgs.map(async (f) => ({
        id: `user-${crypto.randomUUID()}`,
        label: f.name.replace(/\.svg$/i, ''),
        svg: await f.text(),
      })),
    );
    addIcons(icons);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`prepare${dragging ? ' is-dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="prepare-header">
        <a href="/" className="wordmark" aria-label="IconTween home">
          <span className="wordmark-icon">icon</span>
          <span className="wordmark-tween">tween</span>
        </a>
        <span className="prepare-step">Prepare</span>
        <span className="prepare-privacy">Runs in your browser. Nothing is uploaded.</span>
      </header>

      <aside className="prepare-sources" aria-label="Icons">
        <section className="add-icons">
          <label className="button file-button">
            Add SVG files
            <input
              type="file"
              accept=".svg,image/svg+xml"
              multiple
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pasted.trim()) return;
              addIcons([{ id: `user-${crypto.randomUUID()}`, label: 'Pasted SVG', svg: pasted }]);
              setPasted('');
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
              Prepare pasted code
            </button>
          </form>
          <p className="hint">Or drop SVG files anywhere on the page.</p>
        </section>

        {userIcons.length > 0 && (
          <IconList
            title="Your icons"
            icons={userIcons}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
        <IconList
          title="Starter set (Lucide)"
          icons={STARTER_SOURCES}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </aside>

      <main className="prepare-main">
        {selected ? (
          <Workspace
            key={selected.id}
            icon={selected}
            mode={mode}
            showGrid={showGrid}
            onMode={setMode}
            onGrid={setShowGrid}
          />
        ) : (
          <p className="empty">Add an SVG to get started.</p>
        )}
      </main>
    </div>
  );
}

function IconList({
  title,
  icons,
  selectedId,
  onSelect,
}: {
  title: string;
  icons: SourceIcon[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <ul className="icon-list">
        {icons.map((icon) => (
          <li key={icon.id}>
            <button
              type="button"
              className="icon-item"
              aria-current={icon.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(icon.id)}
            >
              <Thumb svg={icon.svg} />
              <span>{icon.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Library thumbnails show the source as-is, but always sanitized first. */
function Thumb({ svg }: { svg: string }) {
  const safe = useMemo(() => sanitizeSvg(svg), [svg]);
  return (
    <span className="thumb">
      {safe.ok ? <MaskedSvg svg={safe.svg} color="currentColor" size={20} /> : '!'}
    </span>
  );
}

function Workspace({
  icon,
  mode,
  showGrid,
  onMode,
  onGrid,
}: {
  icon: SourceIcon;
  mode: CompareMode;
  showGrid: boolean;
  onMode: (m: CompareMode) => void;
  onGrid: (v: boolean) => void;
}) {
  const original = useMemo(() => sanitizeSvg(icon.svg), [icon.svg]);
  const result: PrepareResult = useMemo(() => prepareSvg(icon.svg), [icon.svg]);
  const preparedSvg = useMemo(
    () =>
      result.ok
        ? iconToSvg(result.icon.viewBox, result.icon.elements, result.icon.state.elements)
        : '',
    [result],
  );

  if (!result.ok || !original.ok) {
    return (
      <div className="error" role="alert">
        <h1>{icon.label}</h1>
        <p>{result.ok ? (original as { error: string }).error : result.error}</p>
      </div>
    );
  }

  const { icon: prepared, report } = result;
  const lines = describeReport(report);
  const warnings = new Set(report.warnings);

  return (
    <div className="workspace">
      <div className="canvas-column">
        <div className="toolbar">
          <h1>{icon.label}</h1>
          <div className="segmented" role="group" aria-label="Comparison">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => onMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={showGrid} onChange={(e) => onGrid(e.target.checked)} />
            Grid
          </label>
        </div>

        <Compare
          original={original.svg}
          prepared={preparedSvg}
          viewBox={prepared.viewBox}
          mode={mode}
          showGrid={showGrid}
        />

        <div className="sizes" aria-label="Prepared icon at real sizes">
          {[16, 24, 48].map((size) => (
            <figure key={size}>
              <MaskedSvg svg={preparedSvg} color="var(--fg)" size={size} />
              <figcaption>{size}px</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="details">
        <section>
          <h2 className="section-title">Cleanup report</h2>
          {lines.length === 0 ? (
            <p className="muted">Already canonical. Nothing needed changing.</p>
          ) : (
            <ul className="report">
              {lines.map((line, i) => (
                <li key={i} className={warnings.has(line) ? 'report-warning' : undefined}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="section-title">
            Elements <span className="count">{prepared.elements.length}</span>
          </h2>
          <ul className="elements">
            {prepared.elements.map((el) => {
              const segs = prepared.state.elements[el.id]!.segments;
              const points = segs.filter((s) => s.cmd !== 'Z').length;
              return (
                <li key={el.id}>
                  <span className="element-name">{el.name ?? el.id}</span>
                  <span className="muted">
                    {points} {points === 1 ? 'point' : 'points'} · {segs.map((s) => s.cmd).join('')}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <details className="code">
          <summary>Prepared SVG</summary>
          <pre>{preparedSvg}</pre>
          <button
            type="button"
            className="button"
            onClick={() => void navigator.clipboard.writeText(preparedSvg)}
          >
            Copy
          </button>
        </details>
      </div>
    </div>
  );
}
