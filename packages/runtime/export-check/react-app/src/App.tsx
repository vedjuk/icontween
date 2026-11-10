/**
 * Every exported starter component, used the way its doc comment says. The check page
 * (../page/check.js) loads this app in a frame and drives it: it finds each icon by
 * `data-key`, presses its button or calls its ref, and reads the paths.
 *
 * Each starter shows twice: as exported, and with reducedMotion="reduce" (played by ref).
 */
import { useEffect, useRef } from 'react';
import { icons, type Icon, type IconHandle } from './icons';

declare global {
  interface Window {
    /** Refs by starter key: `handles[key]` as exported, `handles[key + ':reduced']`. */
    iconTweenCheck?: { handles: Record<string, IconHandle | null> };
  }
}

const handles: Record<string, IconHandle | null> = {};
const INTERACTIVE = new Set(['hover', 'click', 'toggle']);

function AsExported({ id, trigger, Component }: { id: string; trigger: string; Component: Icon }) {
  const button = useRef<HTMLButtonElement>(null);
  const keep = (h: IconHandle | null) => {
    handles[id] = h;
  };
  if (!INTERACTIVE.has(trigger)) return <Component ref={keep} size={48} />;
  return (
    <button ref={button} type="button" aria-label={id}>
      <Component ref={keep} size={48} listenOn={button} />
    </button>
  );
}

export function App() {
  useEffect(() => {
    window.iconTweenCheck = { handles };
  }, []);
  return (
    <main style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontFamily: 'system-ui' }}>
      {icons.map(({ key, trigger, Component }) => (
        <figure key={key} style={{ margin: 0, display: 'flex', gap: 4, alignItems: 'center' }}>
          <span data-key={key}>
            <AsExported id={key} trigger={trigger} Component={Component} />
          </span>
          <span data-key={`${key}:reduced`}>
            <Component
              ref={(h) => {
                handles[`${key}:reduced`] = h;
              }}
              size={48}
              trigger="manual"
              reducedMotion="reduce"
            />
          </span>
        </figure>
      ))}
    </main>
  );
}
