/**
 * Editor state. The animation is replaced, never mutated, on every edit (core's edit
 * functions are pure), so undo/redo in M3 can be a stack of animations.
 */
import {
  addStateCopy,
  createAnimation,
  movePoint as movePointIn,
  prepareSvg,
  setElementSegments,
  validateAnimation,
  type Animation,
  type PointRef,
  type Sequence,
  type Transition,
  type TriggerType,
} from '@icontween/core';
import { create } from 'zustand';
import type { SourceIcon } from '../starters';

interface EditorState {
  source: SourceIcon | null;
  animation: Animation | null;
  error: string | null;
  /** The state being edited. */
  stateId: string;
  elementId: string | null;
  point: PointRef | null;
  snap: boolean;
  onion: boolean;

  open(source: SourceIcon): void;
  /** Adds a copy of the last state and starts editing it. */
  addState(): void;
  selectState(id: string): void;
  selectElement(id: string | null): void;
  selectPoint(point: PointRef | null): void;
  /** Moves a point of the selected element in the edited state. */
  movePoint(point: PointRef, x: number, y: number): void;
  /** Updates the transition into the edited state. */
  setTransition(patch: Partial<Transition>): void;
  setTrigger(type: TriggerType): void;
  setRepeat(repeat: Sequence['repeat'], restBetweenLoops?: number): void;
  setSnap(snap: boolean): void;
  setOnion(onion: boolean): void;
}

/** In development, every edit is checked against rule 1 (brief §7). */
function checked(animation: Animation): Animation {
  if (import.meta.env.DEV) {
    const result = validateAnimation(animation);
    if (!result.ok) console.error('Invalid animation after edit', result.issues);
  }
  return animation;
}

export const useEditor = create<EditorState>()((set, get) => ({
  source: null,
  animation: null,
  error: null,
  stateId: 'A',
  elementId: null,
  point: null,
  snap: true,
  onion: true,

  open(source) {
    const result = prepareSvg(source.svg);
    set({
      source,
      animation: result.ok
        ? checked(createAnimation(result.icon, { id: source.id, name: source.label }))
        : null,
      error: result.ok ? null : result.error,
      stateId: 'A',
      elementId: null,
      point: null,
    });
  },

  addState() {
    const { animation } = get();
    if (!animation) return;
    const last = animation.states[animation.states.length - 1]!;
    const next = addStateCopy(animation, last.id);
    set({ animation: checked(next.animation), stateId: next.stateId, point: null });
  },

  selectState: (stateId) => set({ stateId, point: null }),
  selectElement: (elementId) => set({ elementId, point: null }),
  selectPoint: (point) => set({ point }),

  movePoint(point, x, y) {
    const { animation, stateId, elementId } = get();
    if (!animation || !elementId) return;
    const state = animation.states.find((s) => s.id === stateId);
    const segments = state?.elements[elementId]?.segments;
    if (!segments) return;
    const moved = movePointIn(segments, point, x, y);
    set({ animation: checked(setElementSegments(animation, stateId, elementId, moved)) });
  },

  setTransition(patch) {
    const { animation, stateId } = get();
    if (!animation) return;
    const steps = animation.sequence.steps.map((s) => (s.to === stateId ? { ...s, ...patch } : s));
    set({ animation: checked({ ...animation, sequence: { ...animation.sequence, steps } }) });
  },

  setTrigger(type) {
    const { animation } = get();
    if (animation) set({ animation: { ...animation, trigger: { type } } });
  },

  setRepeat(repeat, restBetweenLoops) {
    const { animation } = get();
    if (!animation) return;
    const sequence: Sequence = { ...animation.sequence, repeat };
    if (repeat === 'once' || !restBetweenLoops) delete sequence.restBetweenLoops;
    else sequence.restBetweenLoops = restBetweenLoops;
    set({ animation: checked({ ...animation, sequence }) });
  },

  setSnap: (snap) => set({ snap }),
  setOnion: (onion) => set({ onion }),
}));
