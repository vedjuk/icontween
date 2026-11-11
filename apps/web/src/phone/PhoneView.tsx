/**
 * The phone viewer (decision 024): what the editor shows on phone-sized screens. Moving
 * points and handles needs a pointer and room, so a phone gets one animation, large,
 * played by the runtime that ships (rule 9), with what it's for and how it's timed.
 *
 * It only looks. A share link is read here with the same checks as anywhere, but nothing
 * joins the saved project and nothing asks to replace or retime it: that waits for a
 * bigger screen, where the same link opens in the editor.
 */
import {
  decodeShare,
  matchPattern,
  PURPOSE_DEFAULTS,
  sameEasing,
  sequencePath,
  shareCodeFromHash,
  type Animation,
  type Easing,
  type MotionTokens,
  type Transition,
} from '@icontween/core';
import {
  createPlayer,
  DEFAULT_TOKENS,
  resolveDuration,
  resolveMotion,
  type Player,
  type ReducedMotionPreference,
} from '@icontween/runtime';
import { useEffect, useRef, useState } from 'react';
import { EASINGS, REDUCED_MOTION_LABELS, TRIGGERS } from '../editor/labels';
import { useEditor } from '../editor/store';
import { checkIcon } from '../library/iconCheck';
import { Thumb } from '../library/Library';
import { useLibraryStore } from '../library/libraryStore';
import '../prepare/prepare.css';
import { useSaveStatus } from '../project/persistence';
import { layTokens, shareLinkFor } from '../project/share';
import { STARTER_SOURCES, type SourceIcon } from '../starters';
import { STARTERS, STARTER_TITLES } from '../starterSet';
import { useNoHover } from './usePhone';
import './phone.css';

/** One animation to look at, with the tokens it plays with and the icon it came from. */
interface Viewed {
  animation: Animation;
  tokens: MotionTokens;
  source: SourceIcon | null;
  /** The share link it was opened from, kept as the page address. */
  link: string | null;
}

const SIZES = [48, 24, 16] as const;

const MOTION_OPTIONS: { id: ReducedMotionPreference; label: string }[] = [
  { id: 'auto', label: 'System' },
  { id: 'reduce', label: 'Reduced' },
  { id: 'no-preference', label: 'Full' },
];

const REPEAT_LABELS = { once: '', loop: ', looping', 'ping-pong': ', back and forth' };

const sourceFor = (id: string): SourceIcon | null =>
  [...useLibraryStore.getState().userIcons, ...STARTER_SOURCES].find((i) => i.id === id) ?? null;

/** Your own animation for this icon if you have one, else the shipped starter. */
function byId(id: string | undefined): Viewed | null {
  if (!id) return null;
  const { saved, tokens } = useEditor.getState();
  const mine = saved[id];
  if (mine && mine.sequence.steps.length > 0)
    return { animation: mine, tokens, source: sourceFor(id), link: null };
  const starter = STARTERS.animations.find((a) => a.id === id);
  if (starter)
    return { animation: starter, tokens: STARTERS.motionTokens, source: sourceFor(id), link: null };
  return null;
}

/** What the page address points at: a share link, an icon id, or the last icon open. */
async function fromAddress(): Promise<{ viewed: Viewed | null; error: string | null }> {
  const code = shareCodeFromHash(location.hash);
  if (code === null) {
    const id = location.hash.slice(1) || useSaveStatus.getState().openId;
    return { viewed: byId(id), error: null };
  }
  const result = await decodeShare(code);
  if (!result.ok) return { viewed: null, error: result.error };
  const { animation, tokens, icon } = result.value;
  const source = icon
    ? { id: animation.id, label: icon.fileName.replace(/\.svg$/i, ''), svg: icon.svg }
    : sourceFor(animation.id);
  return {
    viewed: { animation, tokens: layTokens(DEFAULT_TOKENS, tokens), source, link: location.href },
    error: null,
  };
}

export function PhoneView() {
  const [viewed, setViewed] = useState<Viewed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const read = () =>
      void fromAddress().then((r) => {
        if (!live) return;
        setViewed(r.viewed);
        setError(r.error);
        setReady(true);
      });
    read();
    // Back and forward between icons, or a link pasted into this tab.
    addEventListener('hashchange', read);
    return () => {
      live = false;
      removeEventListener('hashchange', read);
    };
  }, []);

  const pick = (next: Viewed) => {
    // A new history entry, so Back returns to the one before.
    history.pushState(null, '', `#${next.animation.id}`);
    setViewed(next);
    setError(null);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="phone">
      <header className="phone-header">
        <a href="/" className="wordmark" aria-label="IconTween home">
          <span className="wordmark-icon">icon</span>
          <span className="wordmark-tween">tween</span>
        </a>
        <span className="prepare-step">Viewer</span>
      </header>

      <main className="phone-main">
        {error && (
          <div className="phone-error" role="alert">
            <h1>Couldn’t open this share link</h1>
            <p>{error}</p>
          </div>
        )}
        {viewed ? (
          <Viewer key={viewed.animation.id + (viewed.link ?? '')} viewed={viewed} />
        ) : (
          ready &&
          !error && (
            <div className="phone-intro">
              <h1>Motion for the moments that matter</h1>
              <p>
                IconTween gives icons purposeful, state-based motion. Pick a starter to see it play.
              </p>
            </div>
          )
        )}
        <BiggerScreen viewed={viewed} />
        <Picker current={viewed?.animation.id} onPick={pick} />
      </main>
    </div>
  );
}

/** The animation, large and at real sizes, and what it is. */
function Viewer({ viewed }: { viewed: Viewed }) {
  const { animation, tokens } = viewed;
  const noHover = useNoHover();
  const [motion, setMotion] = useState<ReducedMotionPreference>('auto');
  const [pressed, setPressed] = useState(false);
  const tileRef = useRef<HTMLButtonElement & HTMLDivElement>(null);
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const players = useRef<Player[]>([]);

  const type = animation.trigger.type;
  const hasMotion = animation.sequence.steps.length > 0;
  // A tap is a hover's enter and leave at once, so on touch it toggles instead: one tap
  // plays it, the next plays it back. Same runtime, only the event that starts it differs.
  const tapForHover = noHover && type === 'hover';
  const asToggle = type === 'toggle' || tapForHover;
  const interactive = hasMotion && (type === 'hover' || type === 'click' || asToggle);
  const title = STARTER_TITLES[animation.id] ?? animation.name;

  useEffect(() => {
    const tile = tileRef.current;
    if (!tile) return;
    setPressed(false); // fresh players start on A
    players.current = svgRefs.current
      .filter((svg): svg is SVGSVGElement => svg !== null)
      .map((svg) => {
        svg.replaceChildren();
        svg.removeAttribute('viewBox');
        return createPlayer(svg, animation, {
          listenOn: tile,
          tokens,
          reducedMotion: motion,
          ...(tapForHover ? { trigger: 'toggle' as const } : {}),
        });
      });
    return () => players.current.forEach((p) => p.destroy());
  }, [animation, tokens, motion, tapForHover]);

  const Tile = interactive ? 'button' : 'div';
  const playByHand = hasMotion && (type === 'appear' || type === 'manual');

  return (
    <article className="phone-viewer" aria-labelledby="phone-title">
      <h1 id="phone-title" className="phone-title">
        {title}
      </h1>
      {title.toLowerCase() !== animation.name.toLowerCase() && (
        <p className="phone-subtitle">{animation.name}</p>
      )}

      <Tile
        ref={tileRef}
        className="phone-tile"
        {...(interactive
          ? { type: 'button' as const, 'aria-label': title, 'aria-describedby': 'phone-hint' }
          : {})}
        {...(asToggle && interactive
          ? { 'aria-pressed': pressed, onClick: () => setPressed((p) => !p) }
          : {})}
      >
        <svg
          ref={(el) => {
            svgRefs.current[0] = el;
          }}
          className="phone-icon"
          aria-hidden="true"
        />
        <span className="phone-sizes" aria-hidden="true">
          {SIZES.map((size, i) => (
            <span key={size} className="phone-size">
              <svg
                ref={(el) => {
                  svgRefs.current[i + 1] = el;
                }}
                width={size}
                height={size}
              />
              <span className="phone-size-label">{size}</span>
            </span>
          ))}
        </span>
      </Tile>

      <div className="phone-controls">
        <p className="phone-hint" id="phone-hint">
          {hint(animation, hasMotion, tapForHover)}
        </p>
        {playByHand && (
          <button
            type="button"
            className="button"
            onClick={() => players.current.forEach((p) => p.play())}
          >
            {type === 'appear' ? 'Replay' : 'Play'}
          </button>
        )}
      </div>

      <div className="phone-motion">
        <span className="hint" id="phone-motion-label">
          Motion
        </span>
        <div className="segmented" role="group" aria-labelledby="phone-motion-label">
          {MOTION_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={motion === o.id}
              onClick={() => setMotion(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <Facts animation={animation} tokens={tokens} tapForHover={tapForHover} />
    </article>
  );
}

function hint(animation: Animation, hasMotion: boolean, tapForHover: boolean): string {
  if (!hasMotion) return 'This one has no motion yet.';
  switch (animation.trigger.type) {
    case 'hover':
      return tapForHover ? 'Tap to play, tap again to play it back' : 'Hover or focus the tile';
    case 'click':
      return 'Tap the tile';
    case 'toggle':
      return 'Tap the tile to toggle';
    case 'loop':
      return 'Plays while it’s on screen';
    case 'appear':
      return 'Played once when it came on screen';
    default:
      return 'Played by code in a real UI';
  }
}

/** Why it moves and how: the decisions behind it, read only. */
function Facts({
  animation,
  tokens,
  tapForHover,
}: {
  animation: Animation;
  tokens: MotionTokens;
  tapForHover: boolean;
}) {
  const purpose = PURPOSE_DEFAULTS[animation.purpose];
  const steps = animation.sequence.steps;
  const trigger =
    TRIGGERS.find((t) => t.id === animation.trigger.type)?.label ?? 'From code (manual)';
  const pattern = matchPattern(animation);

  return (
    <dl className="phone-facts">
      <div>
        <dt>Purpose</dt>
        <dd>
          <strong>{purpose.name}</strong>
          <span className="phone-fact-note">{purpose.hint}</span>
        </dd>
      </div>
      <div>
        <dt>Trigger</dt>
        <dd>
          {trigger}
          {tapForHover && <span className="phone-fact-note">On a touch screen, a tap.</span>}
        </dd>
      </div>
      {steps.length > 0 && (
        <>
          <div>
            <dt>Sequence</dt>
            <dd>
              {sequencePath(animation).join(' → ')}
              {pattern && ` · ${pattern.name}`}
              {REPEAT_LABELS[animation.sequence.repeat]}
            </dd>
          </div>
          <div>
            <dt>Timing</dt>
            <dd>
              <ul className="phone-steps">
                {steps.map((step, i) => (
                  <li key={i}>{timing(step, tokens)}</li>
                ))}
              </ul>
            </dd>
          </div>
        </>
      )}
      <div>
        <dt>Reduced motion</dt>
        <dd>{REDUCED_MOTION_LABELS[animation.reducedMotion.mode]}</dd>
      </div>
      <div>
        <dt>Made of</dt>
        <dd>
          {count(animation.elements.length, 'path')}, {count(animation.states.length, 'state')}
        </dd>
      </div>
    </dl>
  );
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "A → B · 250 ms · Snappy". Springs set their own length, so theirs is approximate. */
function timing(step: Transition, tokens: MotionTokens): string {
  const ms = resolveDuration(step.duration, tokens);
  const resolved: Easing | undefined =
    step.easing.type === 'token' ? tokens.easings[step.easing.name] : step.easing;
  const spring = resolved?.type === 'spring';
  const length = spring
    ? `about ${Math.round(resolveMotion(step.easing, ms, tokens).duration / 10) * 10} ms`
    : `${ms} ms`;
  const easing = EASINGS.find((o) => sameEasing(o.easing, step.easing))?.label ?? 'Custom curve';
  return `${step.from} → ${step.to} · ${length} · ${easing}`;
}

/** Editing waits for a bigger screen; the link carries the animation there. */
function BiggerScreen({ viewed }: { viewed: Viewed | null }) {
  const [status, setStatus] = useState<string | null>(null);
  const canShare = typeof navigator.share === 'function';

  const link = async (): Promise<string> => {
    if (!viewed) return `${location.origin}/editor`;
    if (viewed.link) return viewed.link;
    const source = viewed.source ?? sourceFor(viewed.animation.id);
    return source
      ? shareLinkFor(viewed.animation, viewed.tokens, source)
      : `${location.origin}/editor#${viewed.animation.id}`;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(await link());
      setStatus('Link copied. Open it on a laptop to keep going.');
    } catch {
      setStatus('Couldn’t copy here. Copy the address from the address bar instead.');
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: 'IconTween', url: await link() });
    } catch {
      // Closing the share sheet rejects too; nothing to say.
    }
  };

  return (
    <aside className="phone-bigger" aria-labelledby="phone-bigger-title">
      <h2 id="phone-bigger-title">Editing needs a bigger screen</h2>
      <p>
        Moving points and curve handles needs a mouse or trackpad and some room.{' '}
        {viewed
          ? 'This link opens the animation in the editor on a laptop or desktop.'
          : 'Open IconTween on a laptop or desktop to animate your own icons.'}
      </p>
      <div className="phone-bigger-actions">
        <button type="button" className="button is-primary" onClick={() => void copy()}>
          Copy link
        </button>
        {canShare && (
          <button type="button" className="button" onClick={() => void share()}>
            Share…
          </button>
        )}
      </div>
      <p className="phone-status" role="status">
        {status}
      </p>
    </aside>
  );
}

/** Your own animations (from this browser), then the starters. */
function Picker({ current, onPick }: { current?: string; onPick: (v: Viewed) => void }) {
  const saved = useEditor((s) => s.saved);
  const tokens = useEditor((s) => s.tokens);
  const userIcons = useLibraryStore((s) => s.userIcons);
  const yours = Object.values(saved).filter((a) => a.sequence.steps.length > 0);
  const yourIds = new Set(yours.map((a) => a.id));
  // A starter you've animated yourself shows once, as yours.
  const starters = STARTERS.animations.filter((a) => !yourIds.has(a.id));

  const item = (animation: Animation, viewed: () => Viewed) => {
    const source = [...userIcons, ...STARTER_SOURCES].find((i) => i.id === animation.id);
    return (
      <li key={animation.id}>
        <button
          type="button"
          className="phone-pick"
          aria-current={animation.id === current ? 'true' : undefined}
          onClick={() => onPick(viewed())}
        >
          <Thumb svg={source ? checkIcon(source.svg).svg : null} size={24} />
          <span>{STARTER_TITLES[animation.id] ?? animation.name}</span>
        </button>
      </li>
    );
  };

  return (
    <nav className="phone-picker" aria-label="Animations">
      {yours.length > 0 && (
        <section aria-labelledby="phone-yours">
          <h2 className="section-title" id="phone-yours">
            Yours, in this browser
          </h2>
          <ul>
            {yours.map((a) =>
              item(a, () => ({ animation: a, tokens, source: sourceFor(a.id), link: null })),
            )}
          </ul>
        </section>
      )}
      <section aria-labelledby="phone-starters">
        <h2 className="section-title" id="phone-starters">
          Starters
        </h2>
        <ul>
          {starters.map((a) =>
            item(a, () => ({
              animation: a,
              tokens: STARTERS.motionTokens,
              source: sourceFor(a.id),
              link: null,
            })),
          )}
        </ul>
      </section>
    </nav>
  );
}
