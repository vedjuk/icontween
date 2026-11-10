/**
 * Names for exported files and code, made from the animation's name:
 * "Copy → Check" → copy-check.html, CopyCheckIcon.tsx, copyCheckAnimation.
 */
import type { Animation } from '../schema';

/** Words of a name, ASCII only ("Café → Bell 2" → ["cafe", "bell", "2"]). */
function words(name: string): string[] {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function nameWords(animation: Pick<Animation, 'name' | 'id'>): string[] {
  const w = words(animation.name);
  if (w.length) return w;
  const fromId = words(animation.id);
  return fromId.length ? fromId : ['icon'];
}

const capital = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** File name without extension: "copy-check". */
export function exportFileBase(animation: Pick<Animation, 'name' | 'id'>): string {
  return nameWords(animation).join('-');
}

/** React component name: "CopyCheckIcon". Always a valid identifier starting with a capital. */
export function componentName(animation: Pick<Animation, 'name' | 'id'>): string {
  const w = nameWords(animation);
  if (w[w.length - 1] === 'icon') w.pop();
  const base = w.map(capital).join('');
  return /^[0-9]/.test(base) || !base ? `Icon${base}` : `${base}Icon`;
}

/** Variable that holds the animation data: "copyCheckAnimation". */
export function dataVariableName(animation: Pick<Animation, 'name' | 'id'>): string {
  const w = nameWords(animation);
  const base = w.map((x, i) => (i === 0 ? x : capital(x))).join('');
  return /^[0-9]/.test(base) ? `icon${capital(base)}Animation` : `${base}Animation`;
}

/** Text that is safe inside a /* … *\/ or <!-- … --> comment, on one line. */
export function commentText(text: string): string {
  return text
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/\*\//g, '* /')
    .replace(/--/g, '- -')
    .trim();
}
