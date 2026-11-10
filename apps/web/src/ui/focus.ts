/**
 * Keeping keyboard focus somewhere sensible when the control that had it goes away
 * (decision 021). Without this, focus falls back to the page and the next Tab starts over
 * from the top.
 */

interface Focusable {
  isConnected: boolean;
  focus: (options?: FocusOptions) => void;
}

/** Focuses the first candidate still in the page. Returns whether one was focused. */
export function focusFirst(...candidates: (Focusable | null | undefined)[]): boolean {
  const target = candidates.find((c): c is Focusable => !!c && c.isConnected);
  target?.focus();
  return !!target;
}

/** True when focus was lost: nothing, or the page itself, has it. */
export function focusIsLost(doc: Pick<Document, 'activeElement' | 'body'> = document): boolean {
  return doc.activeElement === null || doc.activeElement === doc.body;
}

/**
 * After React has rendered, moves focus to the element with this id, but only when focus
 * was lost (so it never pulls focus away from where someone moved it).
 */
export function restoreFocusTo(id: string) {
  requestAnimationFrame(() => {
    if (focusIsLost()) focusFirst(document.getElementById(id));
  });
}
