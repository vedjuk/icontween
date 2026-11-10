import {
  describeReport,
  iconToSvg,
  prepareSvg,
  sanitizeSvg,
  type PrepareResult,
} from '@icontween/core';
import { useMemo, useState } from 'react';
import { Library } from '../library/Library';
import { useLibrary } from '../library/useLibrary';
import { STARTER_SOURCES, type SourceIcon } from '../starters';
import { Compare, type CompareMode } from './Compare';
import { DialogHost } from '../ui/Dialog';
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
  const [selectedId, setSelectedId] = useState(STARTER_SOURCES[0]?.id ?? '');
  const [mode, setMode] = useState<CompareMode>('overlay');
  const [showGrid, setShowGrid] = useState(true);
  const library = useLibrary((icon) => setSelectedId(icon.id));
  // A deleted icon falls back to the first starter.
  const selected = library.all.find((i) => i.id === selectedId) ?? STARTER_SOURCES[0];

  return (
    <div className={`prepare${library.dragging ? ' is-dragging' : ''}`} {...library.dropTarget}>
      <header className="prepare-header">
        <a href="/" className="wordmark" aria-label="IconTween home">
          <span className="wordmark-icon">icon</span>
          <span className="wordmark-tween">tween</span>
        </a>
        <span className="prepare-step">Prepare</span>
        <a className="header-link" href={selected ? `/editor#${selected.id}` : '/editor'}>
          Animate in the editor →
        </a>
        <span className="prepare-privacy">Runs in your browser. Nothing is uploaded.</span>
      </header>

      <aside className="prepare-sources" aria-label="Icons">
        <Library library={library} selectedId={selectedId} onSelect={(i) => setSelectedId(i.id)} />
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
      <DialogHost />
    </div>
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
