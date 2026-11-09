/**
 * The editing canvas: the edited state on a viewBox grid, the previous state as an onion
 * skin, and the selected element's anchors and handles, which can be dragged. Dragging an
 * element moves it (translate); the cross is its pivot for rotate and scale.
 */
import {
  editablePoints,
  getPoint,
  paintAttributes,
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
  const { selectElement, selectPoint, movePoint, setValues, setPivot } = useEditor.getState();

  const [minX, minY, w, h] = animation.viewBox;
  const pad = Math.max(w, h) * 0.12;
  const box = [minX - pad, minY - pad, w + 2 * pad, h + 2 * pad];
  /** viewBox units per CSS pixel, for sizing nodes in screen pixels. */
  const unit = box[2]! / SIZE;

  const index = animation.states.findIndex((s) => s.id === stateId);
  const state = animation.states[index] ?? animation.states[0]!;
  const previous: State | undefined = index > 0 ? animation.states[index - 1] : undefined;
  const selected = elementId ? state.elements[elementId] : undefined;

  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const drag = useRef<{ ref: PointRef; dx: number; dy: number; id: number } | null>(null);
  /** Moving a whole element or its pivot, in viewBox coordinates. */
  const move = useRef<{
    kind: 'element' | 'pivot';
    id: number;
    /** Pointer where the drag started, in screen and viewBox coordinates. */
    sx: number;
    sy: number;
    px: number;
    py: number;
    /** Value being dragged (translate or pivot) at the start. */
    x: number;
    y: number;
    started: boolean;
  } | null>(null);

  /** Pointer position in viewBox coordinates. */
  const toRoot = (clientX: number, clientY: number) => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const startMove = (e: React.PointerEvent, kind: 'element' | 'pivot', es: ElementState) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toRoot(e.clientX, e.clientY);
    const t = es.transform;
    move.current = {
      kind,
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      px: p.x,
      py: p.y,
      x: kind === 'element' ? t.translateX : t.originX,
      y: kind === 'element' ? t.translateY : t.originY,
      // Pivots follow at once; elements wait for a real drag so a click only selects.
      started: kind === 'pivot',
    };
  };

  const onMove = (e: React.PointerEvent) => {
    const m = move.current;
    if (!m || m.id !== e.pointerId) return;
    if (!m.started) {
      if (Math.hypot(e.clientX - m.sx, e.clientY - m.sy) < 3) return;
      m.started = true;
    }
    const p = toRoot(e.clientX, e.clientY);
    let dx = p.x - m.px;
    let dy = p.y - m.py;
    const snapOn = snap && !e.altKey;
    if (m.kind === 'element') {
      // Snap the distance moved, so an element off the grid keeps its offset.
      if (snapOn) {
        dx = Math.round(dx / SNAP_STEP) * SNAP_STEP;
        dy = Math.round(dy / SNAP_STEP) * SNAP_STEP;
      }
      setValues({ transform: { translateX: m.x + dx, translateY: m.y + dy } });
    } else {
      let x = m.x + dx;
      let y = m.y + dy;
      if (snapOn) {
        x = Math.round(x / SNAP_STEP) * SNAP_STEP;
        y = Math.round(y / SNAP_STEP) * SNAP_STEP;
      }
      setPivot(x, y);
    }
  };

  const endMove = (e: React.PointerEvent) => {
    if (move.current?.id === e.pointerId) move.current = null;
  };

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
      ref={svgRef}
      className="canvas"
      width={SIZE}
      height={SIZE}
      viewBox={box.join(' ')}
      onPointerDown={() => selectElement(null)}
      onPointerMove={onMove}
      onPointerUp={endMove}
      onPointerCancel={endMove}
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
              if (el.id !== elementId) selectElement(el.id);
              startMove(e, 'element', state.elements[el.id]!);
            }}
          />
        </g>
      ))}

      {selected && (
        <g aria-hidden="true">
          {/* The full outline, so a faded or undrawn element can still be found. */}
          <path
            className="canvas-guide"
            d={segmentsToD(selected.segments)}
            transform={transformAttribute(selected) || undefined}
          />
          <g
            className="canvas-pivot"
            transform={`translate(${selected.transform.translateX + selected.transform.originX} ${selected.transform.translateY + selected.transform.originY})`}
            onPointerDown={(e) => startMove(e, 'pivot', selected)}
          >
            <title>Pivot: drag to move</title>
            {/* Grabbed by a ring, so a point lying under the pivot can still be dragged. */}
            <circle r={8.5 * unit} strokeWidth={6 * unit} className="canvas-pivot-hit" />
            <circle r={4.5 * unit} />
            <line x1={-8 * unit} x2={8 * unit} y1={0} y2={0} />
            <line y1={-8 * unit} y2={8 * unit} x1={0} x2={0} />
          </g>
        </g>
      )}

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
  const paint = paintAttributes(es);
  return (
    <path
      d={segmentsToD(es.segments)}
      transform={transformAttribute(es) || undefined}
      opacity={paint.opacity}
      pathLength={paint.pathLength === undefined ? undefined : Number(paint.pathLength)}
      strokeDasharray={paint.strokeDasharray}
      strokeDashoffset={paint.strokeDashoffset}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      strokeLinecap={style.strokeLinecap}
      strokeLinejoin={style.strokeLinejoin}
      pointerEvents="none"
    />
  );
}

/**
 * Arrow keys nudge the selected point, or the selected element when no point is selected:
 * 0.1, or 1 with Shift. Escape steps back a level.
 */
function useNudgeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select')) return;
      const {
        animation,
        stateId,
        elementId,
        point,
        movePoint,
        setValues,
        selectPoint,
        selectElement,
      } = useEditor.getState();
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
      if (!dir || !elementId || !animation) return;
      const es = animation.states.find((s) => s.id === stateId)?.elements[elementId];
      if (!es) return;
      e.preventDefault();
      const step = e.shiftKey ? 1 : 0.1;
      if (!point) {
        const { translateX, translateY } = es.transform;
        setValues({
          transform: {
            translateX: translateX + dir[0] * step,
            translateY: translateY + dir[1] * step,
          },
        });
        return;
      }
      const at = getPoint(es.segments, point);
      movePoint(point, at.x + dir[0] * step, at.y + dir[1] * step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
