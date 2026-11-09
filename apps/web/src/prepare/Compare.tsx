import type { ViewBox } from '@icontween/core';
import { MaskedSvg } from './MaskedSvg';

export type CompareMode = 'overlay' | 'difference' | 'side-by-side';

interface CompareProps {
  original: string;
  prepared: string;
  viewBox: ViewBox;
  mode: CompareMode;
  showGrid: boolean;
}

/** Original vs prepared, at canvas size. Both are rendered from sanitized markup only. */
export function Compare({ original, prepared, viewBox, mode, showGrid }: CompareProps) {
  if (mode === 'side-by-side') {
    return (
      <div className="compare-pair">
        <figure>
          <Tile viewBox={viewBox} showGrid={showGrid}>
            <MaskedSvg svg={original} color="var(--fg)" />
          </Tile>
          <figcaption>Original</figcaption>
        </figure>
        <figure>
          <Tile viewBox={viewBox} showGrid={showGrid}>
            <MaskedSvg svg={prepared} color="var(--accent)" />
          </Tile>
          <figcaption>Prepared</figcaption>
        </figure>
      </div>
    );
  }

  if (mode === 'difference') {
    // White on black with a difference blend: matching pixels cancel out to black.
    return (
      <figure>
        <Tile viewBox={viewBox} showGrid={showGrid} dark>
          <MaskedSvg svg={original} color="#fff" className="layer" />
          <MaskedSvg svg={prepared} color="#fff" className="layer blend-difference" />
        </Tile>
        <figcaption>
          Matching areas cancel out to black. Faint hairlines on curves are edge smoothing; solid
          shapes mean a real mismatch.
        </figcaption>
      </figure>
    );
  }

  return (
    <figure>
      <Tile viewBox={viewBox} showGrid={showGrid}>
        <MaskedSvg svg={original} color="var(--overlay-original)" className="layer" />
        <MaskedSvg svg={prepared} color="var(--accent)" className="layer overlay-prepared" />
      </Tile>
      <figcaption>
        <span className="swatch swatch-original" /> Original{' '}
        <span className="swatch swatch-prepared" /> Prepared
      </figcaption>
    </figure>
  );
}

function Tile({
  viewBox,
  showGrid,
  dark,
  children,
}: {
  viewBox: ViewBox;
  showGrid: boolean;
  dark?: boolean;
  children: React.ReactNode;
}) {
  const [, , w, h] = viewBox;
  return (
    <div className={`tile${dark ? ' tile-dark' : ''}`} style={{ aspectRatio: `${w} / ${h}` }}>
      {showGrid && <Grid viewBox={viewBox} />}
      {children}
    </div>
  );
}

/** One line per viewBox unit, when that stays readable (up to 64 units). */
function Grid({ viewBox }: { viewBox: ViewBox }) {
  const [x, y, w, h] = viewBox;
  if (w > 64 || h > 64) return null;
  const lines: React.ReactNode[] = [];
  for (let i = 1; i < w; i++) {
    lines.push(<line key={`v${i}`} x1={x + i} y1={y} x2={x + i} y2={y + h} />);
  }
  for (let i = 1; i < h; i++) {
    lines.push(<line key={`h${i}`} x1={x} y1={y + i} x2={x + w} y2={y + i} />);
  }
  return (
    <svg className="grid layer" viewBox={viewBox.join(' ')} aria-hidden="true">
      {lines}
    </svg>
  );
}
