import { create } from 'zustand';
import type { SourceIcon } from '../starters';

/** The user's own icons, newest first. Saved with the project (see `project/persistence.ts`). */
export const useLibraryStore = create<{
  userIcons: SourceIcon[];
  add(icons: SourceIcon[]): void;
}>()((set) => ({
  userIcons: [],
  add: (icons) => set((s) => ({ userIcons: [...icons, ...s.userIcons] })),
}));
