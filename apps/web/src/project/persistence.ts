/**
 * Auto-save: the project lives in IndexedDB, in this browser only (rule 5: nothing is
 * uploaded). It is read once at start-up, before the editor or prepare screen renders,
 * and written shortly after every change to the animations, tokens or library.
 *
 * What's stored is the same `Project` as an exported `.icontween.json` file, read back with
 * the same checks (`readProject`), plus which icon was open.
 */
import { readProject, SCHEMA_VERSION, type MotionTokens, type Project } from '@icontween/core';
import { DEFAULT_TOKENS } from '@icontween/runtime';
import { create } from 'zustand';
import { useEditor } from '../editor/store';
import { useLibraryStore } from '../library/libraryStore';
import type { SourceIcon } from '../starters';

const DB_NAME = 'icontween';
const STORE = 'projects';
const KEY = 'current';
/** Long enough to batch a drag into one write, short enough to lose nothing on close. */
const SAVE_DELAY_MS = 400;
export const PROJECT_NAME = 'IconTween project';

interface StoredProject {
  project: Project;
  /** The icon open in the editor, to come back to it. Not part of exported files. */
  openId?: string;
}

export type SaveStatus = 'loading' | 'saved' | 'saving' | 'unavailable';

/** Shown in the header, so the designer knows their work is kept. */
export const useSaveStatus = create<{ status: SaveStatus; openId?: string }>()(() => ({
  status: 'loading',
}));

let started: Promise<void> | null = null;

/** Loads the saved project into the stores, then keeps saving. Safe to call more than once. */
export function startPersistence(): Promise<void> {
  started ??= (async () => {
    const db = await openDb().catch(() => null);
    if (!db) {
      useSaveStatus.setState({ status: 'unavailable' });
      return;
    }
    const stored = await get(db).catch(() => undefined);
    if (stored) {
      const result = readProject(stored.project);
      if (result.ok) {
        applyProject(result.value);
        useSaveStatus.setState({ openId: stored.openId });
      } else {
        // Keep the damaged copy rather than overwrite it with an empty project.
        console.error('Saved project could not be read; keeping a backup', result.error);
        await put(db, stored, `backup-${Date.now()}`).catch(() => undefined);
      }
    }
    useSaveStatus.setState({ status: 'saved' });
    watch(db);
  })();
  return started;
}

/** Puts a project into the stores: library icons, animations and tokens. */
export function applyProject(project: Project): void {
  useLibraryStore.setState({ userIcons: project.library.map(toSource) });
  useEditor.getState().loadProject({
    animations: project.animations,
    tokens: withDefaultTokens(project.motionTokens),
  });
}

/** The project as it is now, as saved and exported. */
export function currentProject(): Project {
  const { saved, tokens } = useEditor.getState();
  return {
    schemaVersion: SCHEMA_VERSION,
    name: PROJECT_NAME,
    motionTokens: tokens,
    library: useLibraryStore.getState().userIcons.map((icon) => ({
      id: icon.id,
      fileName: `${icon.label}.svg`,
      svg: icon.svg,
    })),
    animations: Object.values(saved),
  };
}

function toSource(icon: Project['library'][number]): SourceIcon {
  return { id: icon.id, label: icon.fileName.replace(/\.svg$/i, ''), svg: icon.svg };
}

/**
 * The token names are fixed (the editor tunes values, it doesn't add names), so a file's
 * tokens are laid over the defaults: unknown names are dropped, missing ones filled in, and
 * an easing that changed kind (curve vs spring) falls back to the default.
 */
function withDefaultTokens(tokens: MotionTokens): MotionTokens {
  const durations = { ...DEFAULT_TOKENS.durations };
  for (const name of Object.keys(durations)) {
    const ms = tokens.durations[name];
    if (ms !== undefined && Number.isFinite(ms) && ms >= 0) durations[name] = ms;
  }
  const easings = { ...DEFAULT_TOKENS.easings };
  for (const [name, fallback] of Object.entries(easings)) {
    const easing = tokens.easings[name];
    if (easing?.type === fallback.type) easings[name] = easing;
  }
  return { durations, easings };
}

/** Saves after changes settle, and right away when the tab is hidden or closed. */
function watch(db: IDBDatabase) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = undefined;
    const record: StoredProject = {
      project: currentProject(),
      openId: useEditor.getState().source?.id,
    };
    put(db, record)
      .then(() => useSaveStatus.setState({ status: 'saved' }))
      .catch((e: unknown) => {
        console.error('Saving failed', e);
        useSaveStatus.setState({ status: 'unavailable' });
      });
  };
  const schedule = () => {
    useSaveStatus.setState({ status: 'saving' });
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY_MS);
  };

  useEditor.subscribe((s, prev) => {
    if (s.saved !== prev.saved || s.tokens !== prev.tokens || s.source !== prev.source) schedule();
  });
  useLibraryStore.subscribe((s, prev) => {
    if (s.userIcons !== prev.userIcons) schedule();
  });
  const flush = () => {
    if (timer !== undefined) save();
  };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

// --- A few lines of IndexedDB, so there's no dependency for it.

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function get(db: IDBDatabase): Promise<StoredProject | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result as StoredProject | undefined);
    request.onerror = () => reject(request.error);
  });
}

function put(db: IDBDatabase, record: StoredProject, key = KEY): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
