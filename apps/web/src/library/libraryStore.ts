import { create } from 'zustand';
import type { SourceIcon } from '../starters';

/** How one file (or a paste) went when it was added to the library. */
export type ImportResult =
  | { name: string; status: 'added'; iconId: string; notes: string[] }
  | { name: string; status: 'failed'; error: string };

/** The user's own icons, newest first. Saved with the project (see `project/persistence.ts`). */
export const useLibraryStore = create<{
  userIcons: SourceIcon[];
  /** The last import, file by file, until dismissed. Not saved. */
  lastImport: ImportResult[] | null;
  add(icons: SourceIcon[]): void;
  rename(id: string, label: string): void;
  remove(id: string): void;
  setImport(results: ImportResult[] | null): void;
}>()((set) => ({
  userIcons: [],
  lastImport: null,
  add: (icons) => set((s) => ({ userIcons: [...icons, ...s.userIcons] })),
  rename: (id, label) =>
    set((s) => ({ userIcons: s.userIcons.map((i) => (i.id === id ? { ...i, label } : i)) })),
  remove: (id) => set((s) => ({ userIcons: s.userIcons.filter((i) => i.id !== id) })),
  setImport: (results) => set({ lastImport: results }),
}));
