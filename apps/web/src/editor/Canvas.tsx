/**
 * The editing canvas: the edited state on a viewBox grid, the previous state as an onion
 * skin, and the selected element's anchors and handles, which can be dragged.
 */
import {
  editablePoints,
  getPoint,
  segmentsToD,
  transformAttribute,
  type ElementState,
  type ElementStyle,
  type PointRef,
  type State,
} from '@icontween/core';
import { useEffect, useRef } from 'react';
import { useEditor } from './store';

/** Canvas size in CSS pixels. */
const SIZE = 480;
/** Snap step in viewBox units. */
export const SNAP_STEP = 0.5;

const samePoint = (a: PointRef | null, b: PointRef) =>
  a !== null && a.segment === b.segment && a.role === b.role;

export function Canvas() {
  const animation = useEditor((s) => s.animation)!;
  const stateId = useEditor((s) => s.stateId);
  const elementId = useEditor((s) => s.elementId);
  const point = useEditor((s) => s.point);
  const snap = useEditor((s) => s.snap);
  const onion = useEditor((s) => s.onion);
  const { selectElement, selectPoint, movePoint } = useEditor.getState();

  const [minX, minY, w, h] = animation.viewBox;
  const pad = Math.max(w, h) * 0.12;
  const box = [minX - pad, minY - pad, w + 2 * pad, h + 2 * pad];
  /** viewBox units per CSS pixel, for sizing nodes in screen pixels. */
  const unit = box[2]! / SIZE;

  const index = animation.states.findIndex((s) => s.id === stateId);
  const state = animation.states[index] ?? animation.states[0]!;
  const previous: State | undefined = index > 0 ? animation.states[index - 1] : undefined;
  const selected = elementId ? state.elements[elementId] : undefined;

  const groupRef = useRef<SVGGElement>(null);
  const drag = useRef<{ ref: PointRef; dx: number; dy: number; id: number } | null>(null);

  /** Pointer position in the selected element's (untransformed) coordinates. */
  const toLocal = (clientX: number, clientY: number) => {
    const ctm = groupRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const startDrag = (e: React.PointerEvent, ref: PointRef, es: ElementState) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = getPoint(es.segments, ref);
    const p = toLocal(e.clientX, e.clientY);
    // Keep the grab offset so the point doesn't jump under the cursor.
    drag.current = { ref, dx: at.x - p.x, dy: at.y - p.y, id: e.pointerId };
    selectPoint(ref);
  };

  const onDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = toLocal(e.clientX, e.clientY);
    let x = p.x + d.dx;
    let y = p.y + d.dy;
    // Alt (Option) turns snapping off while held.
    if (snap && !e.altKey) {
      x = Math.round(x / SNAP_STEP) * SNAP_STEP;
      y = Math.round(y / SNAP_STEP) * SNAP_STEP;
    }
    movePoint(d.ref, x, y);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  useNudgeKeys();

  const gridLines = [];
  for (let x = Math.ceil(minX); x <= minX + w; x++) {
    gridLines.push(<line key={`x${x}`} x1={x} y1={minY} x2={x} y2={minY + h} />);
  }
  for (let y = Math.ceil(minY); y <= minY + h; y++) {
    gridLines.push(<line key={`y${y}`} x1={minX} y1={y} x2={minX + w} y2={y} />);
  }

  return (
    <svg
      className="canvas"
      width={SIZE}
      height={SIZE}
      viewBox={box.join(' ')}
      onPointerDown={() => selectElement(null)}
      role="application"
      aria-label={`Canvas, editing state ${state.id}`}
    >
      <rect className="canvas-artboard" x={minX} y={minY} width={w} height={h} />
      <g className="canvas-grid">{gridLines}</g>

      {onion && previous && (
        <g className="canvas-onion" aria-hidden="true">
          {animation.elements.map((el) => (
            <ElementPath key={el.id} es={previous.elements[el.id]!} style={el.style} />
          ))}
        </g>
      )}

      {animation.elements.map((el) => (
        <g key={el.id} className={el.id === elementId ? 'canvas-selected' : undefined}>
          <ElementPath es={state.elements[el.id]!} style={el.style} />
          {/* A wider invisible stroke makes thin lines easy to click. */}
          <path
            className="canvas-hit"
            d={segmentsToD(state.elements[el.id]!.segments)}
            transform={transformAttribute(state.elements[el.id]!) || undefined}
            strokeWidth={Math.max(el.style.strokeWidth, 12 * unit)}
            pointerEvents={el.style.fill === 'none' ? 'stroke' : 'all'}
            onPointerDown={(e) => {
              e.stopPropagation();
              selectElement(el.id);
            }}
          />
        </g>
      ))}

      {selected && (
        <g
          ref={groupRef}
          className="canvas-nodes"
          transform={transformAttribute(selected) || undefined}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {editablePoints(selected.segments).map((p) => {
            const ref = { segment: p.segment, role: p.role };
            const active = samePoint(point, ref);
            const isHandle = p.role !== 'anchor';
            return (
              <g key={`${p.segment}-${p.role}`}>
                {isHandle && p.anchorX !== undefined && (
                  <line
                    className="canvas-handle-line"
                    x1={p.anchorX}
                    y1={p.anchorY}
                    x2={p.x}
                    y2={p.y}
                  />
                )}
                <circle
                  className={`canvas-node${isHandle ? ' is-handle' : ''}${active ? ' is-active' : ''}`}
                  cx={p.x}
                  cy={p.y}
                  r={(isHandle ? 3.5 : 5) * unit}
                  onPointerDown={(e) => startDrag(e, ref, selected)}
                />
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

function ElementPath({ es, style }: { es: ElementState; style: ElementStyle }) {
  return (
    <path
      d={segmentsToD(es.segments)}
      transform={transformAttribute(es) || undefined}
      opacity={es.opacity === 1 ? undefined : es.opacity}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      strokeLinecap={style.strokeLinecap}
      strokeLinejoin={style.strokeLinejoin}
      pointerEvents="none"
    />
  );
}

/** Arrow keys nudge the selected point: 0.1, or 1 with Shift. Escape steps back a level. */
function useNudgeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      const { animation, stateId, elementId, point, movePoint, selectPoint, selectElement } =
        useEditor.getState();
      if (e.key === 'Escape') {
        if (point) selectPoint(null);
        else selectElement(null);
        return;
      }
      const dirs: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const dir = dirs[e.key];
      if (!dir || !point || !elementId || !animation) return;
      const segments = animation.states.find((s) => s.id === stateId)?.elements[elementId]
        ?.segments;
      if (!segments) return;
      e.preventDefault();
      const step = e.shiftKey ? 1 : 0.1;
      const at = getPoint(segments, point);
      movePoint(point, at.x + dir[0] * step, at.y + dir[1] * step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
