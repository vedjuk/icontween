import { prepareSvg } from '@icontween/core';
import { useMemo, useState, type DragEvent } from 'react';
import { STARTER_SOURCES, type SourceIcon } from '../starters';
import { useLibraryStore, type ImportResult } from './libraryStore';

/** A file or a paste on its way into the library. */
interface Incoming {
  name: string;
  label: string;
  svg: string | null;
}

const isSvgFile = (f: File) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);

/**
 * Checks each incoming SVG the way the editor will open it (sanitize + prepare), adds the
 * ones that work and reports every one, so a batch of files never fails silently.
 * The source text is stored untouched (rule 3); preparing works on its own copy.
 */
export function importIcons(incoming: Incoming[]): {
  icons: SourceIcon[];
  results: ImportResult[];
} {
  const icons: SourceIcon[] = [];
  const results: ImportResult[] = [];
  for (const item of incoming) {
    if (item.svg === null) {
      results.push({ name: item.name, status: 'failed', error: 'Not an SVG file.' });
      continue;
    }
    const prepared = prepareSvg(item.svg);
    if (!prepared.ok) {
      results.push({ name: item.name, status: 'failed', error: prepared.error });
      continue;
    }
    const icon = { id: `user-${crypto.randomUUID()}`, label: item.label, svg: item.svg };
    icons.push(icon);
    results.push({
      name: item.name,
      status: 'added',
      iconId: icon.id,
      notes: prepared.report.warnings,
    });
  }
  return { icons, results };
}

/** The user's icons (saved in this browser) plus drag-and-drop handling. */
export function useLibrary(onAdded: (first: SourceIcon) => void) {
  const userIcons = useLibraryStore((s) => s.userIcons);
  const [dragging, setDragging] = useState(false);

  /** Returns how many icons were added. */
  const add = (incoming: Incoming[]) => {
    if (incoming.length === 0) return 0;
    const { icons, results } = importIcons(incoming);
    const store = useLibraryStore.getState();
    // Keep the order they were picked in at the top of the list.
    if (icons.length > 0) store.add(icons);
    store.setImport(results);
    if (icons[0]) onAdded(icons[0]);
    return icons.length;
  };

  const addFiles = async (files: FileList | File[]) =>
    add(
      await Promise.all(
        [...files].map(async (f) => ({
          name: f.name,
          label: f.name.replace(/\.svg$/i, ''),
          svg: isSvgFile(f) ? await f.text() : null,
        })),
      ),
    );

  const addPasted = (svg: string) => add([{ name: 'Pasted SVG', label: 'Pasted SVG', svg }]);

  /** Spread onto the page's root element. */
  const dropTarget = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (e.currentTarget === e.target) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      void addFiles(e.dataTransfer.files);
    },
  };

  const all = useMemo(() => [...userIcons, ...STARTER_SOURCES], [userIcons]);
  return { userIcons, all, dragging, dropTarget, addFiles, addPasted };
}
