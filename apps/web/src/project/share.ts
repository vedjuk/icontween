/**
 * Share links in the editor: making one for the open animation, and opening one.
 *
 * The animation travels in the URL hash (`/editor#a=…`, see core's `share.ts`), which the
 * browser never sends to a server. Opening a link reads it with the same checks as Import.
 */
import {
  decodeShare,
  encodeShare,
  readAnimation,
  setDurationToken,
  setEasingToken,
  shareAnimation,
  SHARE_HASH_KEY,
  type Animation,
  type Easing,
  type MotionTokens,
} from '@icontween/core';
import { useEditor } from '../editor/store';
import { useLibraryStore } from '../library/libraryStore';
import { STARTER_SOURCES, type SourceIcon } from '../starters';
import { askConfirm, showMessage } from '../ui/Dialog';

/** A link to the open animation, or null when nothing is open. */
export async function makeShareLink(): Promise<string | null> {
  const { animation, source, tokens } = useEditor.getState();
  if (!animation || !source) return null;
  return shareLinkFor(animation, tokens, source);
}

/** A link to any animation, made from the icon it came from. */
export async function shareLinkFor(
  animation: Animation,
  tokens: MotionTokens,
  source: SourceIcon,
): Promise<string> {
  // Starters ship with the app; anything else travels with the link.
  const builtIn = STARTER_SOURCES.some((s) => s.id === source.id);
  const icon = builtIn ? undefined : { fileName: `${source.label}.svg`, svg: source.svg };
  const code = await encodeShare(shareAnimation(animation, tokens, icon));
  return `${location.origin}/editor#${SHARE_HASH_KEY}=${code}`;
}

/**
 * Opens a share link's code: checks it, asks before it replaces anything, and opens the
 * animation. Resolves to whether it was opened.
 */
export async function openShareLink(code: string): Promise<boolean> {
  const result = await decodeShare(code);
  if (!result.ok) {
    await showMessage({ title: 'Couldn’t open this share link', message: result.error });
    return false;
  }
  const { animation, tokens: linkTokens, icon } = result.value;
  const { saved, tokens } = useEditor.getState();

  // The icon it was made from: one already here, or the one in the link.
  const library = [...useLibraryStore.getState().userIcons, ...STARTER_SOURCES];
  let source: SourceIcon | undefined = library.find((i) => i.id === animation.id);
  if (!source && icon) {
    source = { id: animation.id, label: icon.fileName.replace(/\.svg$/i, ''), svg: icon.svg };
    useLibraryStore.getState().add([source]);
  }
  if (!source) {
    await showMessage({
      title: 'Couldn’t open this share link',
      message: `It uses an icon (${animation.name}) this version of IconTween doesn’t have.`,
    });
    return false;
  }

  const mine = saved[animation.id];
  if (mine && !sameAnimation(mine, animation)) {
    const ok = await askConfirm({
      title: `Replace your ${animation.name} animation?`,
      message:
        `You already have an animation for ${animation.name}. The shared one replaces it ` +
        '(this can’t be undone). Export first to keep a copy.',
      confirmLabel: 'Replace',
    });
    if (!ok) return false;
  }

  const merged = layTokens(tokens, linkTokens);
  const changes = tokenChanges(tokens, merged);
  let useTokens = changes.length > 0;
  const others = Object.keys(saved).filter((id) => id !== animation.id).length;
  if (useTokens && others > 0) {
    // Tokens are shared by the whole project, so this would retime the other animations.
    useTokens = await askConfirm({
      title: 'Use the link’s timing?',
      message:
        `The shared animation uses motion tokens set differently from yours: ` +
        `${changes.join(', ')}. Using its values also changes your other ` +
        `${others === 1 ? 'animation' : `${others} animations`}.`,
      confirmLabel: 'Use the link’s',
      cancelLabel: 'Keep mine',
    });
  }

  useEditor.getState().openShared(source, animation, useTokens ? merged : undefined);
  return true;
}

/** Compares an animation in the project with one read from a link (fields in read order). */
function sameAnimation(mine: Animation, shared: Animation): boolean {
  const read = readAnimation(JSON.parse(JSON.stringify(mine)));
  return read.ok && JSON.stringify(read.value) === JSON.stringify(shared);
}

/**
 * The link's token values laid over the project's. Names the app doesn't know, and easings
 * of another kind, are skipped; values are clamped as if set in the inspector.
 */
export function layTokens(mine: MotionTokens, link: MotionTokens): MotionTokens {
  let out = mine;
  for (const [name, ms] of Object.entries(link.durations)) {
    if (name in out.durations) out = setDurationToken(out, name, ms);
  }
  for (const [name, easing] of Object.entries(link.easings)) {
    if (out.easings[name]?.type === easing.type) out = setEasingToken(out, name, easing);
  }
  return out;
}

/** "base 250 ms (yours 200 ms)", "snappy easing" for each token that differs. */
function tokenChanges(mine: MotionTokens, next: MotionTokens): string[] {
  const changes: string[] = [];
  for (const [name, ms] of Object.entries(next.durations)) {
    if (mine.durations[name] !== ms)
      changes.push(`${name} ${ms} ms (yours ${mine.durations[name]} ms)`);
  }
  for (const [name, easing] of Object.entries(next.easings)) {
    if (!sameEasing(mine.easings[name], easing)) changes.push(`${name} easing`);
  }
  return changes;
}

function sameEasing(a: Easing | undefined, b: Easing): boolean {
  if (!a) return false;
  const fields = Object.entries(b);
  const other = a as unknown as Record<string, unknown>;
  return fields.length === Object.keys(a).length && fields.every(([k, v]) => other[k] === v);
}
