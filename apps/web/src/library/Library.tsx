/**
 * The icon library sidebar: add SVG files, paste code, drop files anywhere on the page,
 * and pick from your icons or the starter set. Shared by the prepare screen and the editor.
 */
import { sanitizeSvg } from '@icontween/core';
import { useMemo, useState } from 'react';
import { MaskedSvg } from '../prepare/MaskedSvg';
import { STARTER_SOURCES, type SourceIcon } from '../starters';
import type { useLibrary } from './useLibrary';

export function Library({
  library,
  selectedId,
  onSelect,
}: {
  library: ReturnType<typeof useLibrary>;
  selectedId: string;
  onSelect: (icon: SourceIcon) => void;
}) {
  const [pasted, setPasted] = useState('');
  const { userIcons, addIcons, addFiles } = library;
  return (
    <>
      <section className="add-icons">
        <label className="button file-button">
          Add SVG files
          <input
            type="file"
            accept=".svg,image/svg+xml"
            multiple
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pasted.trim()) return;
            addIcons([{ id: `user-${crypto.randomUUID()}`, label: 'Pasted SVG', svg: pasted }]);
            setPasted('');
          }}
        >
          <label htmlFor="paste" className="visually-hidden">
            SVG code
          </label>
          <textarea
            id="paste"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'<svg viewBox="0 0 24 24">…</svg>'}
            spellCheck={false}
            rows={3}
          />
          <button type="submit" className="button">
            Use pasted code
          </button>
        </form>
        <p className="hint">Or drop SVG files anywhere on the page.</p>
      </section>

      {userIcons.length > 0 && (
        <IconList
          title="Your icons"
          icons={userIcons}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
      <IconList
        title="Starter set (Lucide)"
        icons={STARTER_SOURCES}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </>
  );
}

function IconList({
  title,
  icons,
  selectedId,
  onSelect,
}: {
  title: string;
  icons: SourceIcon[];
  selectedId: string;
  onSelect: (icon: SourceIcon) => void;
}) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <ul className="icon-list">
        {icons.map((icon) => (
          <li key={icon.id}>
            <button
              type="button"
              className="icon-item"
              aria-current={icon.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(icon)}
            >
              <Thumb svg={icon.svg} />
              <span>{icon.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Library thumbnails show the source as-is, but always sanitized first. */
function Thumb({ svg }: { svg: string }) {
  const safe = useMemo(() => sanitizeSvg(svg), [svg]);
  return (
    <span className="thumb">
      {safe.ok ? <MaskedSvg svg={safe.svg} color="currentColor" size={20} /> : '!'}
    </span>
  );
}
