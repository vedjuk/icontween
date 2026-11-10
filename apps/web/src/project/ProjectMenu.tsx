/**
 * Header controls for the project: where it's saved, and moving it in and out of the
 * browser as an `.icontween.json` file.
 */
import {
  parseProject,
  PROJECT_FILE_EXTENSION,
  serializeProject,
  type Project,
} from '@icontween/core';
import { useEditor } from '../editor/store';
import { useLibraryStore } from '../library/libraryStore';
import { askConfirm, showMessage } from '../ui/Dialog';
import { applyProject, currentProject, useSaveStatus, type SaveStatus } from './persistence';

const STATUS: Record<SaveStatus, string> = {
  loading: 'Loading…',
  saving: 'Saving…',
  saved: 'Saved in this browser. Nothing is uploaded.',
  unavailable: "Can't save in this browser (private window?). Export to keep your work.",
};

export function ProjectMenu({ onImported }: { onImported: (project: Project) => void }) {
  const status = useSaveStatus((s) => s.status);
  const animations = useEditor((s) => Object.keys(s.saved).length);

  const importFile = async (file: File) => {
    const result = parseProject(await file.text());
    if (!result.ok) {
      await showMessage({ title: `Couldn’t open ${file.name}`, message: result.error });
      return;
    }
    const icons = useLibraryStore.getState().userIcons.length;
    if (animations > 0 || icons > 0) {
      const ok = await askConfirm({
        title: `Replace your work with ${file.name}?`,
        message:
          `It has ${count(result.value.animations.length, 'animation')} and ` +
          `${count(result.value.library.length, 'icon')}. ` +
          `What’s in this browser now (${count(animations, 'animation')}, ` +
          `${count(icons, 'icon')}) will be gone. Export first to keep a copy.`,
        confirmLabel: 'Replace',
      });
      if (!ok) return;
    }
    applyProject(result.value);
    onImported(result.value);
  };

  return (
    <div className="project-menu">
      <span className={`save-status is-${status}`}>{STATUS[status]}</span>
      {/* Only a problem is announced: "Saving…" after every edit would talk over the work. */}
      <span className="visually-hidden" role="status">
        {status === 'unavailable' ? STATUS.unavailable : ''}
      </span>
      <label className="button file-button" title={`Open an ${PROJECT_FILE_EXTENSION} file`}>
        Import
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = '';
          }}
        />
      </label>
      <button
        type="button"
        className="button"
        onClick={exportProject}
        title={`Download every animation, your icons and the motion tokens as ${PROJECT_FILE_EXTENSION}`}
      >
        Export
      </button>
    </div>
  );
}

function exportProject() {
  const text = serializeProject(currentProject());
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `icontween-${new Date().toISOString().slice(0, 10)}${PROJECT_FILE_EXTENSION}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function count(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
