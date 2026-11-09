// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createPlayer, type PlayerOptions } from '../src';
import { fakeClock, LINEAR, makeSvg, testAnimation, yOf } from './helpers';

function setup(anim = testAnimation(), options: PlayerOptions = {}) {
  const clock = fakeClock();
  const svg = makeSvg();
  const onFinish = vi.fn();
  const player = createPlayer(svg, anim, {
    clock,
    reducedMotion: 'no-preference',
    onFinish,
    ...options,
  });
  const y = (id?: string) => yOf(player.values, id);
  const d = () => svg.querySelector('path')!.getAttribute('d');
  return { clock, svg, player, onFinish, y, d };
}

describe('play and reverse', () => {
  it('starts on state A and morphs to B over the duration', () => {
    const { clock, player, y, d, onFinish } = setup();
    expect(y()).toBe(0);
    player.play();
    expect(player.playing).toBe(true);
    clock.advance(50);
    expect(y()).toBeCloseTo(5);
    expect(d()).toBe('M0 5 L10 5');
    clock.advance(60);
    expect(y()).toBe(10);
    expect(player.playing).toBe(false);
    expect(onFinish).toHaveBeenCalledWith('B');
  });

  it('applies the easing', () => {
    const { clock, player, y } = setup(
      testAnimation({}, { easing: { type: 'token', name: 'standard' } }),
    );
    player.play();
    clock.advance(50);
    // The standard curve is well past halfway at half time.
    expect(y()).toBeGreaterThan(7);
  });

  it('reverses back to A, and does nothing at A', () => {
    const { clock, player, y, onFinish } = setup();
    player.reverse();
    expect(player.playing).toBe(false);
    player.play();
    clock.advance(200);
    player.reverse();
    clock.advance(50);
    expect(y()).toBeCloseTo(5);
    clock.advance(60);
    expect(y()).toBe(0);
    expect(onFinish).toHaveBeenLastCalledWith('A');
  });

  it('runs multi-step sequences in order and backwards', () => {
    const anim = testAnimation();
    anim.sequence.steps.push({ from: 'B', to: 'C', duration: 100, easing: LINEAR });
    const { clock, player, y } = setup(anim);
    player.play();
    clock.advance(150);
    expect(y()).toBeCloseTo(15);
    clock.advance(100);
    expect(y()).toBe(20);
    player.reverse();
    clock.advance(150);
    expect(y()).toBeCloseTo(5);
  });

  it('carries leftover frame time into the next step', () => {
    const anim = testAnimation();
    anim.sequence.steps.push({ from: 'B', to: 'C', duration: 100, easing: LINEAR });
    const { clock, player, y } = setup(anim);
    player.play();
    clock.advance(130, 130); // one long frame
    expect(y()).toBeCloseTo(13);
  });

  it('restarts from the first state when played at the end', () => {
    const { clock, player, y } = setup();
    player.play();
    clock.advance(200);
    player.play();
    expect(y()).toBe(0);
    clock.advance(50);
    expect(y()).toBeCloseTo(5);
  });

  it('resolves duration tokens', () => {
    const { clock, player, y } = setup(testAnimation({}, { duration: { token: 'slow' } }));
    player.play();
    clock.advance(200);
    expect(y()).toBeCloseTo(5);
  });
});

describe('interruption', () => {
  it('reverses from the current values, taking the time already spent', () => {
    const { clock, player, y } = setup();
    player.play();
    clock.advance(30);
    expect(y()).toBeCloseTo(3);
    player.reverse();
    // Back from 3 to 0 in 30 ms: no jump at the turn.
    expect(y()).toBeCloseTo(3);
    clock.advance(15);
    expect(y()).toBeCloseTo(1.5);
    clock.advance(20);
    expect(y()).toBe(0);
    expect(player.playing).toBe(false);
  });

  it('goes forward again from mid-reverse', () => {
    const { clock, player, y } = setup();
    player.play();
    clock.advance(200);
    player.reverse();
    clock.advance(40); // y = 6
    player.play();
    expect(y()).toBeCloseTo(6);
    clock.advance(20); // 40 ms to cover 4, halfway
    expect(y()).toBeCloseTo(8);
    clock.advance(30);
    expect(y()).toBe(10);
  });

  it('keeps going when asked for the direction it is already heading', () => {
    const { clock, player, y } = setup();
    player.play();
    clock.advance(50);
    player.play();
    clock.advance(25);
    expect(y()).toBeCloseTo(7.5);
  });

  it('stop() freezes, and later calls resume from there', () => {
    const { clock, player, y } = setup();
    player.play();
    clock.advance(40);
    player.stop();
    clock.advance(100);
    expect(y()).toBeCloseTo(4);
    player.reverse();
    clock.advance(20);
    expect(y()).toBeCloseTo(2);
  });

  it('toggle() turns around mid-flight and from rest', () => {
    const { clock, player, y } = setup();
    player.toggle();
    clock.advance(50);
    player.toggle();
    clock.advance(100);
    expect(y()).toBe(0);
    player.toggle();
    clock.advance(200);
    expect(y()).toBe(10);
    player.toggle();
    clock.advance(200);
    expect(y()).toBe(0);
  });

  it('setState() jumps without animating', () => {
    const { player, y } = setup();
    player.setState('B');
    expect(y()).toBe(10);
    expect(player.playing).toBe(false);
    expect(() => player.setState('Z')).toThrow(/unknown state/);
  });
});

describe('delays and stagger', () => {
  it('offsets elements, and mirrors the offsets on the way back', () => {
    const { clock, player, y } = setup(testAnimation({}, { stagger: 50 }));
    player.play();
    clock.advance(50);
    expect(y('el-1')).toBeCloseTo(5);
    expect(y('el-2')).toBeCloseTo(1); // y 1 → 11, not started yet
    clock.advance(50);
    expect(y('el-1')).toBe(10);
    expect(y('el-2')).toBeCloseTo(6);
    clock.advance(100);
    player.reverse();
    clock.advance(50);
    // On the way back el-2 leaves first.
    expect(y('el-2')).toBeCloseTo(6);
    expect(y('el-1')).toBe(10);
  });

  it('uses per-element delays', () => {
    const { clock, player, y } = setup(testAnimation({}, { delays: { 'el-1': 100 } }));
    player.play();
    clock.advance(100);
    expect(y('el-1')).toBe(0);
    expect(y('el-2')).toBe(11);
    clock.advance(100);
    expect(y('el-1')).toBe(10);
  });
});

describe('reduced motion', () => {
  const reduced = (mode: 'instant' | 'fade' | 'none') =>
    setup(testAnimation({ reducedMotion: { mode } }), { reducedMotion: 'reduce' });

  it('instant: swaps at once and keeps the step timing', () => {
    const anim = testAnimation({ reducedMotion: { mode: 'instant' } });
    anim.sequence.steps.push({ from: 'B', to: 'A', duration: 100, easing: LINEAR });
    const { clock, player, y } = setup(anim, { reducedMotion: 'reduce' });
    player.play();
    expect(y()).toBe(10);
    clock.advance(90);
    expect(y()).toBe(10);
    clock.advance(20);
    expect(y()).toBe(0);
  });

  it('fade: dips opacity and swaps at the midpoint', () => {
    const { clock, player, y, svg } = reduced('fade');
    const opacity = () => svg.querySelector('path')!.getAttribute('opacity');
    player.play();
    clock.advance(30);
    expect(y()).toBe(0);
    expect(opacity()).toBe('0.4');
    clock.advance(40);
    expect(y()).toBe(10);
    expect(opacity()).toBe('0.4');
    clock.advance(40);
    expect(opacity()).toBeNull();
  });

  it('fade: never longer than 200 ms', () => {
    const { clock, player, y } = setup(
      testAnimation({ reducedMotion: { mode: 'fade' } }, { duration: 1000 }),
      { reducedMotion: 'reduce' },
    );
    player.play();
    clock.advance(210);
    expect(y()).toBe(10);
    expect(player.playing).toBe(false);
  });

  it('none: stays on state A', () => {
    const { clock, player, y } = reduced('none');
    player.play();
    player.toggle();
    clock.advance(200);
    expect(y()).toBe(0);
  });

  it("'auto' follows prefers-reduced-motion", () => {
    const matchMedia = vi.fn(() => ({ matches: true }));
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      const { player, y } = setup(testAnimation(), { reducedMotion: 'auto' });
      player.play();
      expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
      expect(y()).toBe(10);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('can be switched at runtime (editor preview)', () => {
    const { player, y } = setup();
    player.setReducedMotion('reduce');
    player.play();
    expect(y()).toBe(10);
  });
});

describe('triggers', () => {
  const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));

  it('hover plays on enter and reverses on leave', () => {
    const { clock, svg, y } = setup(testAnimation({ trigger: { type: 'hover' } }));
    fire(svg, 'pointerenter');
    clock.advance(50);
    fire(svg, 'pointerleave');
    clock.advance(60);
    expect(y()).toBe(0);
  });

  it('hover also responds to keyboard focus, without double-triggering', () => {
    const button = document.createElement('button');
    const { clock, y } = setup(testAnimation({ trigger: { type: 'hover' } }), {
      listenOn: button,
    });
    fire(button, 'focusin');
    clock.advance(200);
    expect(y()).toBe(10);
    fire(button, 'pointerenter');
    fire(button, 'focusout'); // still hovered
    clock.advance(200);
    expect(y()).toBe(10);
    fire(button, 'pointerleave');
    clock.advance(200);
    expect(y()).toBe(0);
  });

  it('click plays, toggle toggles', () => {
    const click = setup(testAnimation({ trigger: { type: 'click' } }));
    fire(click.svg, 'click');
    click.clock.advance(200);
    expect(click.y()).toBe(10);

    const toggle = setup(testAnimation({ trigger: { type: 'toggle' } }));
    fire(toggle.svg, 'click');
    toggle.clock.advance(200);
    fire(toggle.svg, 'click');
    toggle.clock.advance(200);
    expect(toggle.y()).toBe(0);
  });

  it("'none' and destroy() bind nothing", () => {
    const off = setup(testAnimation({ trigger: { type: 'click' } }), { trigger: 'none' });
    fire(off.svg, 'click');
    expect(off.player.playing).toBe(false);

    const gone = setup(testAnimation({ trigger: { type: 'click' } }));
    gone.player.destroy();
    fire(gone.svg, 'click');
    expect(gone.player.playing).toBe(false);
  });
});

describe('guards', () => {
  it('rejects states whose structure differs from A', () => {
    const anim = testAnimation();
    anim.states[1]!.elements['el-1']!.segments.push({ cmd: 'Z' });
    expect(() => setup(anim)).toThrow(/different path structure/);
  });

  it('rejects states missing an element', () => {
    const anim = testAnimation();
    delete anim.states[1]!.elements['el-2'];
    expect(() => setup(anim)).toThrow(/missing element el-2/);
  });

  it('does not mutate the animation while playing', () => {
    const anim = testAnimation();
    const before = JSON.stringify(anim);
    const { clock, player } = setup(anim);
    player.play();
    clock.advance(50);
    player.reverse();
    clock.advance(100);
    expect(JSON.stringify(anim)).toBe(before);
  });
});
