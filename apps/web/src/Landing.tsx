/**
 * The landing page: the idea in a few lines, then the starter set playing live (decision
 * 019). Each starter plays with the runtime that ships in exports (rule 9) and opens in the
 * editor through a share link, so it goes through the same checks and questions as any link.
 */
import {
  encodeShare,
  parseProject,
  PURPOSE_DEFAULTS,
  PURPOSES,
  shareAnimation,
  SHARE_HASH_KEY,
  type Animation,
  type Project,
  type Purpose,
  type TriggerType,
} from '@icontween/core';
import { createPlayer, type Player } from '@icontween/runtime';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import startersFile from '../../../examples/starters.icontween.json?raw';
import './landing.css';
import { STEPS } from './steps';

const STARTERS: Project = (() => {
  const result = parseProject(startersFile);
  if (!result.ok) throw new Error(`examples/starters.icontween.json: ${result.error}`);
  return result.value;
})();

/** What each starter is for, in the words of the moment it serves. Keyed by icon id. */
const TITLES: Record<string, string> = {
  'lucide-pause': 'Play ↔ pause',
  'lucide-menu': 'Menu ↔ close',
  'lucide-lock': 'Lock ↔ unlock',
  'lucide-eye-off': 'Show ↔ hide',
  'lucide-volume-2': 'Sound ↔ mute',
  'lucide-copy': 'Copied',
  'lucide-send': 'Sent',
  'lucide-download': 'Download',
  'lucide-refresh-cw': 'Loading',
  'lucide-bell': 'Notification',
  'lucide-search': 'Search',
  'lucide-heart': 'Like',
};

const HINTS: Record<TriggerType, string> = {
  hover: 'Hover or focus',
  click: 'Click',
  toggle: 'Click to toggle',
  loop: 'Loops while on screen',
  appear: 'Plays once on arrival',
  manual: 'Played by your code',
};

const INTERACTIVE: TriggerType[] = ['hover', 'click', 'toggle'];

const PRINCIPLES = [
  {
    title: 'Motion needs a purpose',
    text: 'Every animation starts from why it exists: feedback, a change of state, a call for attention, a hint, or (rarely) delight.',
  },
  {
    title: 'For the few moments that matter',
    text: 'If every icon moves, none is special. IconTween is for the handful of icons in a product that earn it, not for animating a whole set.',
  },
  {
    title: 'Guardrails developers accept',
    text: 'Opinionated defaults, visible overrides, and exports that are small, readable code: SVG with SMIL, HTML, React or JSON.',
  },
  {
    title: 'Reduced motion, designed',
    text: 'Each animation decides what happens when someone asks for less motion. It’s part of the design, not an afterthought.',
  },
];

/** State changes first: the morphs are the craft the tool is for. */
const ORDER: Purpose[] = ['state-change', 'feedback', 'attention', 'discoverability', 'delight'];
const byPurpose = [...ORDER, ...PURPOSES.filter((p) => !ORDER.includes(p))]
  .map((purpose) => ({
    purpose,
    animations: STARTERS.animations.filter((a) => a.purpose === purpose),
  }))
  .filter((group) => group.animations.length > 0);

const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
const subscribeReduced = (onChange: () => void) => {
  reducedQuery.addEventListener('change', onChange);
  return () => reducedQuery.removeEventListener('change', onChange);
};

export function Landing() {
  const links = useShareLinks();
  const reduced = useSyncExternalStore(subscribeReduced, () => reducedQuery.matches);

  return (
    <div className="landing">
      <header className="landing-hero">
        {/* "twn" are the keyframes; the two e's arrive as the in-betweens. */}
        <h1 className="wordmark landing-wordmark" aria-label="IconTween">
          <span className="wordmark-icon">icon</span>
          <span className="wordmark-tween">
            tw
            <span className="wordmark-inbetween">
              <span>e</span>
            </span>
            <span className="wordmark-inbetween">
              <span>e</span>
            </span>
            n
          </span>
        </h1>
        <p className="landing-tagline">Motion for the moments that matter.</p>
        <p className="landing-lede">
          Bring your own SVG icon and give it purposeful, state-based motion, from smart presets to
          every last point. Then hand it off as small, readable code.
        </p>
        <div className="landing-actions">
          <a className="landing-button" href="/editor">
            Open the editor
          </a>
          <a className="landing-button landing-button-quiet" href="#starters">
            See the starters
          </a>
        </div>
      </header>

      <main>
        <section className="landing-principles" aria-labelledby="principles-title">
          <h2 id="principles-title" className="visually-hidden">
            Principles
          </h2>
          <ul>
            {PRINCIPLES.map((p) => (
              <li key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="starters" className="landing-starters" aria-labelledby="starters-title">
          <h2 id="starters-title">Twelve starters</h2>
          <p className="landing-section-lede">
            Each one serves a purpose. Try them here, then open one in the editor to see how it’s
            made and make it yours.
          </p>
          {reduced && (
            <p className="landing-reduced-note" role="note">
              Your system asks for reduced motion, so these play their reduced versions: some switch
              instantly, some fade, some stay still.
            </p>
          )}

          {byPurpose.map(({ purpose, animations }) => (
            <PurposeGroup key={purpose} purpose={purpose} animations={animations} links={links} />
          ))}
        </section>

        <section className="landing-make" aria-labelledby="make-title">
          <h2 id="make-title">Make your own</h2>
          <p className="landing-section-lede">
            The starters are a place to begin. The tool is for your icons.
          </p>
          <ol className="landing-steps">
            {STEPS.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
          <a className="landing-button" href="/editor">
            Open the editor
          </a>
        </section>
      </main>

      <footer className="landing-footer">
        <p>
          Everything runs in your browser. Nothing you make is uploaded.{' '}
          <a href="https://github.com/vedjuk/icontween">Source on GitHub</a> (MIT). Starter icons
          from <a href="https://lucide.dev">Lucide</a> (ISC).
        </p>
      </footer>
    </div>
  );
}

function PurposeGroup({
  purpose,
  animations,
  links,
}: {
  purpose: Purpose;
  animations: Animation[];
  links: Record<string, string>;
}) {
  const { name, hint } = PURPOSE_DEFAULTS[purpose];
  const id = `purpose-${purpose}`;
  return (
    <section className="landing-purpose" aria-labelledby={id}>
      <div className="landing-purpose-text">
        <h3 id={id}>{name}</h3>
        <p>{hint}</p>
      </div>
      <ul className="landing-cards">
        {animations.map((animation) => (
          <StarterCard key={animation.id} animation={animation} link={links[animation.id]} />
        ))}
      </ul>
    </section>
  );
}

function StarterCard({ animation, link }: { animation: Animation; link?: string }) {
  const title = TITLES[animation.id] ?? animation.name;
  const trigger = animation.trigger.type;
  const interactive = INTERACTIVE.includes(trigger);
  const tileRef = useRef<HTMLButtonElement & HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const tile = tileRef.current;
    if (!svg || !tile) return;
    const player = createPlayer(svg, animation, {
      listenOn: tile,
      tokens: STARTERS.motionTokens,
    });
    playerRef.current = player;
    return () => {
      player.destroy();
      playerRef.current = null;
      svg.replaceChildren(); // StrictMode mounts twice; start from an empty svg
      svg.removeAttribute('viewBox');
    };
  }, [animation]);

  // The tile is the control for interactive triggers, like the button an icon sits in.
  const Tile = interactive ? 'button' : 'div';
  return (
    <li className="landing-card">
      <Tile
        ref={tileRef}
        className="landing-tile"
        {...(interactive ? { type: 'button' as const, 'aria-label': title } : {})}
      >
        <svg ref={svgRef} className="landing-icon" aria-hidden="true" />
        <span className="landing-tile-hint">
          {HINTS[trigger]}
          {trigger === 'appear' && (
            <>
              {' · '}
              <button
                type="button"
                className="landing-replay"
                onClick={() => playerRef.current?.play()}
                aria-label={`Replay ${title}`}
              >
                Replay
              </button>
            </>
          )}
        </span>
      </Tile>
      <div className="landing-card-footer">
        <h4>{title}</h4>
        <a className="landing-edit" href={link ?? `/editor#${animation.id}`}>
          Edit<span className="visually-hidden"> {title} in the editor</span>
        </a>
      </div>
    </li>
  );
}

/**
 * Share links for every starter, made once (encoding is async). Until they're ready the
 * cards link to the bare icon, which opens it in the editor without the animation.
 */
function useShareLinks(): Record<string, string> {
  const [links, setLinks] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    void Promise.all(
      STARTERS.animations.map(async (a) => {
        const code = await encodeShare(shareAnimation(a, STARTERS.motionTokens));
        return [a.id, `/editor#${SHARE_HASH_KEY}=${code}`] as const;
      }),
    ).then((entries) => {
      if (live) setLinks(Object.fromEntries(entries));
    });
    return () => {
      live = false;
    };
  }, []);
  return links;
}
