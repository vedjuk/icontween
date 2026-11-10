/**
 * Editor state. The animation is replaced, never mutated, on every edit (core's edit
 * functions are pure), so undo/redo in M3 can be a stack of animations.
 */
import {
  addStateCopy,
  applyPattern,
  applyPurposeDefaults,
  createAnimation,
  movePoint as movePointIn,
  prepareSvg,
  resetElementValues,
  setElementDelay,
  setElementSegments,
  setElementValues,
  setDurationToken,
  setEasingToken,
  setPivot as setPivotIn,
  setPurpose,
  setSequencePath,
  setStepTiming,
  validateAnimation,
  type Animation,
  type Easing,
  type ElementValuesPatch,
  type MotionTokens,
  type PatternId,
  type PointRef,
  type Purpose,
  type ReducedMotion,
  type Sequence,
  type StepTimingPatch,
  type TriggerType,
} from '@icontween/core';
import { DEFAULT_TOKENS, type ReducedMotionPreference } from '@icontween/runtime';
import { create } from 'zustand';
import type { SourceIcon } from '../starters';

interface EditorState {
  source: SourceIcon | null;
  animation: Animation | null;
  error: string | null;
  /** The state being edited. */
  stateId: string;
  /** The selected step of the sequence (its transition is shown in the inspector). */
  stepIndex: number;
  elementId: string | null;
  point: PointRef | null;
  snap: boolean;
  onion: boolean;
  /** Project motion tokens, shared by every animation (kept when another icon opens). */
  tokens: MotionTokens;
  /** How the preview treats reduced motion: like the OS, or forced either way. */
  previewMotion: ReducedMotionPreference;

  open(source: SourceIcon): void;
  /** Adds a copy of the last state and starts editing it. */
  addState(): void;
  /** Edits a state, and selects the first step into it if there is one. */
  selectState(id: string): void;
  /** Selects a step and edits the state it goes to. */
  selectStep(index: number): void;
  selectElement(id: string | null): void;
  selectPoint(point: PointRef | null): void;
  /** Moves a point of the selected element in the edited state. */
  movePoint(point: PointRef, x: number, y: number): void;
  /** Changes the selected element's transform, opacity or draw in the edited state. */
  setValues(patch: ElementValuesPatch): void;
  /** Resets the selected element's transform, opacity and draw in the edited state. */
  resetValues(): void;
  /** Moves the selected element's pivot, in every state. */
  setPivot(x: number, y: number): void;
  /** Rebuilds the sequence along a path of state ids (see core's `setSequencePath`). */
  setPath(path: string[]): void;
  applyPattern(id: PatternId): void;
  /** Duration, easing or stagger of the selected step. */
  setStepTiming(patch: StepTimingPatch): void;
  /** One element's delay in the selected step. */
  setDelay(elementId: string, ms: number): void;
  setTrigger(type: TriggerType): void;
  /** Changes the purpose; parts still on the old defaults follow (see core's `setPurpose`). */
  setPurpose(purpose: Purpose): void;
  /** Puts trigger, pattern, timing and reduced motion back to the purpose's defaults. */
  resetToPurposeDefaults(): void;
  setReducedMotion(mode: ReducedMotion['mode']): void;
  setDurationToken(name: string, ms: number): void;
  setEasingToken(name: string, easing: Easing): void;
  resetTokens(): void;
  setPreviewMotion(preference: ReducedMotionPreference): void;
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
  stepIndex: 0,
  elementId: null,
  point: null,
  snap: true,
  onion: true,
  tokens: DEFAULT_TOKENS,
  previewMotion: 'auto',

  open(source) {
    const result = prepareSvg(source.svg);
    // A new icon keeps the purpose of the last one: designers tend to work on one kind.
    const purpose = get().animation?.purpose;
    set({
      source,
      animation: result.ok
        ? checked(createAnimation(result.icon, { id: source.id, name: source.label, purpose }))
        : null,
      error: result.ok ? null : result.error,
      stateId: 'A',
      stepIndex: 0,
      elementId: null,
      point: null,
    });
  },

  addState() {
    const { animation } = get();
    if (!animation) return;
    const last = animation.states[animation.states.length - 1]!;
    const next = addStateCopy(animation, last.id);
    const steps = next.animation.sequence.steps;
    set({
      animation: checked(next.animation),
      stateId: next.stateId,
      stepIndex: Math.max(
        0,
        steps.findIndex((s) => s.to === next.stateId),
      ),
      point: null,
    });
  },

  selectState(stateId) {
    const { animation, stepIndex } = get();
    const steps = animation?.sequence.steps ?? [];
    // Keep the selected step if it already goes there (B in A→B→A→B).
    const into =
      steps[stepIndex]?.to === stateId ? stepIndex : steps.findIndex((s) => s.to === stateId);
    set({ stateId, point: null, ...(into !== -1 && { stepIndex: into }) });
  },

  selectStep(stepIndex) {
    const step = get().animation?.sequence.steps[stepIndex];
    if (step) set({ stepIndex, stateId: step.to, point: null });
  },
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

  setValues(patch) {
    const { animation, stateId, elementId } = get();
    if (!animation || !elementId) return;
    set({ animation: checked(setElementValues(animation, stateId, elementId, patch)) });
  },

  resetValues() {
    const { animation, stateId, elementId } = get();
    if (!animation || !elementId) return;
    set({ animation: checked(resetElementValues(animation, stateId, elementId)) });
  },

  setPivot(x, y) {
    const { animation, elementId } = get();
    if (!animation || !elementId) return;
    set({ animation: checked(setPivotIn(animation, elementId, x, y)) });
  },

  setPath(path) {
    const { animation, stepIndex } = get();
    if (animation) set(withSequence(setSequencePath(animation, path), stepIndex));
  },

  applyPattern(id) {
    const { animation, stepIndex } = get();
    if (animation) set(withSequence(applyPattern(animation, id), stepIndex));
  },

  setStepTiming(patch) {
    const { animation, stepIndex } = get();
    if (animation?.sequence.steps[stepIndex]) {
      set({ animation: checked(setStepTiming(animation, stepIndex, patch)) });
    }
  },

  setDelay(elementId, ms) {
    const { animation, stepIndex } = get();
    if (animation?.sequence.steps[stepIndex]) {
      set({ animation: checked(setElementDelay(animation, stepIndex, elementId, ms)) });
    }
  },

  setTrigger(type) {
    const { animation } = get();
    if (animation) set({ animation: { ...animation, trigger: { type } } });
  },

  setPurpose(purpose) {
    const { animation, stepIndex } = get();
    if (animation) set(withSequence(setPurpose(animation, purpose), stepIndex));
  },

  resetToPurposeDefaults() {
    const { animation, stepIndex } = get();
    if (animation) set(withSequence(applyPurposeDefaults(animation), stepIndex));
  },

  setReducedMotion(mode) {
    const { animation } = get();
    if (animation) set({ animation: checked({ ...animation, reducedMotion: { mode } }) });
  },

  setDurationToken: (name, ms) => set({ tokens: setDurationToken(get().tokens, name, ms) }),
  setEasingToken: (name, easing) => set({ tokens: setEasingToken(get().tokens, name, easing) }),
  resetTokens: () => set({ tokens: DEFAULT_TOKENS }),
  setPreviewMotion: (previewMotion) => set({ previewMotion }),

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

/** After the sequence changed: keeps the selected step in range. */
function withSequence(animation: Animation, stepIndex: number) {
  const last = Math.max(0, animation.sequence.steps.length - 1);
  return { animation: checked(animation), stepIndex: Math.min(stepIndex, last) };
}
