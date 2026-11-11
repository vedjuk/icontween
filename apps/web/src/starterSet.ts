/**
 * The shipped starter animations (examples/starters.icontween.json), read once with the
 * same checks as any project file. The landing page and the phone viewer play them.
 */
import { parseProject, type Project } from '@icontween/core';
import startersFile from '../../../examples/starters.icontween.json?raw';

export const STARTERS: Project = (() => {
  const result = parseProject(startersFile);
  if (!result.ok) throw new Error(`examples/starters.icontween.json: ${result.error}`);
  return result.value;
})();

/** What each starter is for, in the words of the moment it serves. Keyed by icon id. */
export const STARTER_TITLES: Record<string, string> = {
  'lucide-pause': 'Play ↔ pause',
  'lucide-menu': 'Menu ↔ close',
  'lucide-lock': 'Lock ↔ unlock',
  'lucide-eye-off': 'Show ↔ hide',
  'lucide-volume-2': 'Sound ↔ mute',
  'lucide-copy': 'Copied',
  'lucide-send': 'Sent',
  'lucide-download': 'Download',
  'lucide-refresh-cw': 'Loading',
  'lucide-bell': 'Notification',
  'lucide-search': 'Search',
  'lucide-heart': 'Like',
};
