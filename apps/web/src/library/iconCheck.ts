import { iconToSvg, prepareSvg, sanitizeSvg } from '@icontween/core';

/** What a library icon looks like once prepared, and what the designer should know. */
export type IconCheck =
  { ok: true; svg: string; notes: string[] } | { ok: false; error: string; svg: string | null };

const cache = new Map<string, IconCheck>();

/**
 * Prepares an icon once per source text, for thumbnails and notes. The thumbnail shows the
 * prepared clone, so anything left out (text, images…) is already missing in the list.
 */
export function checkIcon(source: string): IconCheck {
  let check = cache.get(source);
  if (!check) {
    const result = prepareSvg(source);
    if (result.ok) {
      const { viewBox, elements, state } = result.icon;
      check = {
        ok: true,
        svg: iconToSvg(viewBox, elements, state.elements),
        notes: result.report.warnings,
      };
    } else {
      // Show the source as-is (still sanitized) so the icon can be recognised.
      const safe = sanitizeSvg(source);
      check = { ok: false, error: result.error, svg: safe.ok ? safe.svg : null };
    }
    cache.set(source, check);
  }
  return check;
}
