/**
 * Renaming and deleting your own icons. The library and the editor's animations live in two
 * stores; both are saved together (project/persistence.ts), so they change together here.
 */
import { useEditor } from '../editor/store';
import type { SourceIcon } from '../starters';
import { askConfirm } from '../ui/Dialog';
import { useLibraryStore } from './libraryStore';

export function renameIcon(id: string, label: string) {
  const name = label.trim();
  if (!name) return;
  useLibraryStore.getState().rename(id, name);
  useEditor.getState().renameIcon(id, name);
}

/**
 * Asks first: the source SVG and any animation of it are gone for good. Resolves true when
 * the icon was deleted.
 */
export async function deleteIcon(icon: SourceIcon): Promise<boolean> {
  const animated = icon.id in useEditor.getState().saved;
  const ok = await askConfirm({
    title: `Delete ${icon.label}?`,
    message: animated
      ? 'The icon and its animation are removed from this project. This can’t be undone.'
      : 'The icon is removed from this project. This can’t be undone.',
    confirmLabel: 'Delete',
  });
  if (!ok) return false;
  useLibraryStore.getState().remove(icon.id);
  useEditor.getState().forgetIcon(icon.id);
  const { lastImport, setImport } = useLibraryStore.getState();
  if (lastImport) {
    const rest = lastImport.filter((r) => !(r.status === 'added' && r.iconId === icon.id));
    setImport(rest.length > 0 ? rest : null);
  }
  if (location.hash === `#${icon.id}`) history.replaceState(null, '', location.pathname);
  return true;
}
