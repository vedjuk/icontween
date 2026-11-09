import { useMemo, useState, type DragEvent } from 'react';
import { STARTER_SOURCES, type SourceIcon } from '../starters';

/** User icons for this page (not persisted until M4) plus drag-and-drop handling. */
export function useLibrary(onAdded: (first: SourceIcon) => void) {
  const [userIcons, setUserIcons] = useState<SourceIcon[]>([]);
  const [dragging, setDragging] = useState(false);

  const addIcons = (icons: SourceIcon[]) => {
    if (icons.length === 0) return;
    setUserIcons((prev) => [...icons, ...prev]);
    onAdded(icons[0]!);
  };

  const addFiles = async (files: FileList | File[]) => {
    const svgs = [...files].filter((f) => f.type === 'image/svg+xml' || f.name.endsWith('.svg'));
    const icons = await Promise.all(
      svgs.map(async (f) => ({
        id: `user-${crypto.randomUUID()}`,
        label: f.name.replace(/\.svg$/i, ''),
        svg: await f.text(),
      })),
    );
    addIcons(icons);
  };

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
  return { userIcons, all, dragging, dropTarget, addIcons, addFiles };
}
