/**
 * Whether the screen is phone-sized, and whether it can hover. Below 48rem the editor and
 * the Prepare step show the phone viewer instead (decision 024). Both follow live changes,
 * such as turning a tablet or resizing a window.
 */
import { useSyncExternalStore } from 'react';

/** The landing page stacks at the same width. */
export const PHONE_QUERY = '(max-width: 47.99rem)';
const NO_HOVER_QUERY = '(hover: none)';

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => matchMedia(query).matches,
  );
}

export const usePhone = () => useMedia(PHONE_QUERY);

/** Touch screens: a "hover" is a tap there, so hover triggers need another way to play. */
export const useNoHover = () => useMedia(NO_HOVER_QUERY);
