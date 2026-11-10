/**
 * The export check (decision 018). Runs in whichever browser opens it and compares every
 * export with the runtime, which the editor preview uses (rule 9):
 *
 * - SVG + SMIL: each file is paused and seeked (`setCurrentTime`) to 61 times per run and
 *   compared with the runtime on a fake clock, as the browser renders both: path points
 *   (`getPointAtLength`, with the transform from `getScreenCTM`), opacity and dashes
 *   (computed style). Full and reduced motion, forwards and back. The trigger is fired
 *   the way a person would (click, mouseover, …) and must start the timer.
 * - HTML + runtime and React: each export runs for real in a visible frame. The check
 *   presses its button (or calls its ref), waits, and compares where it ends with where
 *   the runtime ends; on the way it must have moved. Loops must keep moving.
 *
 * What it can't see: smoothness, and the <img> copies. Those are in the gallery below.
 */
/* global IconTween */

const TOLERANCE = 0.1; // viewBox units (0.1 px at 24 px), or opacity / draw fraction
const INTERACTIVE = new Set(['hover', 'click', 'toggle']);
const BACKWARDS = new Set(['hover', 'toggle', 'manual']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

const $ = (s) => document.querySelector(s);
const lab = $('#lab');
const stage = $('#stage');
const osReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Reading what a path shows ---------------------------------------------------------

/**
 * What a path shows, read back from the browser: six points along it in the svg's viewBox
 * units (transform applied), opacity, and the drawn part when dashed.
 */
function lookOf(path) {
  const root = path.ownerSVGElement;
  const style = path.ownerDocument.defaultView.getComputedStyle(path);
  const m = root.getScreenCTM().inverse().multiply(path.getScreenCTM());
  const length = path.getTotalLength();
  const points = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => {
    const p = path.getPointAtLength(length * f);
    return [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f];
  });
  const dash = style.strokeDasharray;
  return {
    points,
    opacity: parseFloat(style.opacity),
    drawn: !dash || dash === 'none' ? 1 : parseFloat(dash),
    start: -parseFloat(style.strokeDashoffset || '0') || 0,
  };
}

/** Largest difference between two looks (same rule as runtime/test/smil.test.ts). */
function difference(a, b) {
  if (a.opacity < 0.01 && b.opacity < 0.01) return Math.abs(a.opacity - b.opacity);
  let worst = 0;
  a.points.forEach(([x, y], i) => {
    const [x2, y2] = b.points[i];
    worst = Math.max(worst, Math.hypot(x - x2, y - y2));
  });
  return Math.max(
    worst,
    Math.abs(a.opacity - b.opacity),
    a.drawn < 1 || b.drawn < 1 ? Math.abs(a.drawn - b.drawn) + Math.abs(a.start - b.start) : 0,
  );
}

const worstOf = (as, bs) => Math.max(0, ...as.map((a, i) => difference(a, bs[i])));
const looks = (svg) => [...svg.querySelectorAll('path[data-icontween-element]')].map(lookOf);

// --- The runtime on a fake clock, as the reference -------------------------------------

function fakeClock() {
  let time = 0;
  let id = 0;
  const callbacks = new Map();
  return {
    now: () => time,
    frame(cb) {
      callbacks.set(++id, cb);
      return id;
    },
    cancel(i) {
      callbacks.delete(i);
    },
    advance(ms, step = 5) {
      let left = ms;
      while (left > 1e-9) {
        const dt = Math.min(step, left);
        time += dt;
        left -= dt;
        const due = [...callbacks.values()];
        callbacks.clear();
        due.forEach((cb) => cb());
      }
    },
  };
}

/** A runtime player in the lab frame, driven by hand. */
function reference(data, reduced) {
  const doc = lab.contentDocument;
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '48');
  svg.setAttribute('height', '48');
  doc.body.append(svg);
  const clock = fakeClock();
  const player = IconTween.createPlayer(svg, data, {
    trigger: 'none',
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    clock,
  });
  return {
    svg,
    player,
    clock,
    /**
     * Runs until the player comes to rest. Returns how long that took (ms) and whether
     * anything looked different from the start on the way (a full turn ends where it began).
     */
    settle() {
      const began = clock.now();
      const before = looks(svg);
      let moves = false;
      while (player.playing && clock.now() - began < 20000) {
        clock.advance(10);
        moves ||= worstOf(looks(svg), before) > TOLERANCE;
      }
      return { duration: clock.now() - began, moves };
    },
    done() {
      player.destroy();
      svg.remove();
    },
  };
}

// --- SVG + SMIL ------------------------------------------------------------------------

/** One run of an exported SVG, seeked and compared with the reference. */
function smilCase(item, data, text, reduced, direction) {
  const doc = lab.contentDocument;
  const win = doc.defaultView;
  const parsed = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  const svg = doc.importNode(parsed, true);
  doc.body.append(svg);
  const ref = reference(data, reduced);
  const problems = [];
  try {
    const [motion, second] = svg.querySelectorAll(':scope > g');
    motion.style.display = reduced ? 'none' : 'inline';
    second.style.display = reduced ? 'inline' : 'none';
    const paths = [...(reduced ? second : motion).querySelectorAll('path')];
    const timer = svg.querySelector('animate[id$="Play"]');
    const id = timer.id.slice(0, -'Play'.length);
    const byId = (suffix) => svg.querySelector(`[id="${id}${suffix}"]`);
    const playDuration = parseFloat(timer.getAttribute('dur'));

    svg.pauseAnimations();
    svg.setCurrentTime(0);

    /** Fires the trigger at the current time, like a person (or the docs' code) would. */
    const fire = (dir) => {
      const t = item.trigger;
      const event = (el, type) => el.dispatchEvent(new win.MouseEvent(type, { bubbles: true }));
      if (t === 'click') event(byId('Hit'), 'click');
      else if (t === 'hover') event(byId('Hit'), dir === 'play' ? 'mouseover' : 'mouseout');
      else if (t === 'toggle') {
        const hit = byId(dir === 'play' ? 'HitPlay' : 'HitReverse');
        if (win.getComputedStyle(hit).display === 'none') {
          problems.push(`toggle: the ${dir} hit area is hidden when it should take the click`);
        }
        event(hit, 'click');
      } else if (t === 'manual') byId(dir === 'play' ? 'Play' : 'Reverse').beginElement();
      // loop and appear begin at 0s by themselves.
      const started = dir === 'play' ? timer : byId('Reverse');
      try {
        const at = started.getStartTime() * 1000;
        if (Math.abs(at - svg.getCurrentTime() * 1000) > 1) {
          problems.push(`${dir} timer started at ${at} ms, not when triggered`);
        }
      } catch {
        problems.push(`the ${t} trigger didn't start the ${dir} timer`);
      }
    };

    let began = 0;
    fire('play');
    ref.player.play();
    if (direction === 'reverse') {
      began = playDuration + 100;
      svg.setCurrentTime(began / 1000);
      ref.clock.advance(began);
      fire('reverse');
      ref.player.reverse();
    }
    const run = direction === 'play' ? timer : byId('Reverse');
    const duration = parseFloat(run.getAttribute('dur'));
    const repeats = run.getAttribute('repeatCount') === 'indefinite';
    const span = repeats ? duration * 2.5 : duration + 100;
    const refPaths = [...ref.svg.querySelectorAll('path')];
    let worst = 0;
    let worstAt = 0;
    for (let k = 0; k <= 60; k++) {
      // A quarter millisecond off whole and half milliseconds, so no sample sits on a jump.
      const t = Math.round((span * k) / 60) + 0.25;
      svg.setCurrentTime((began + t) / 1000);
      ref.clock.advance(began + t - ref.clock.now(), 5);
      const d = worstOf(paths.map(lookOf), refPaths.map(lookOf));
      if (d > worst) [worst, worstAt] = [d, t];
    }
    if (worst > TOLERANCE) problems.push(`off by ${worst.toFixed(3)} at ${Math.round(worstAt)} ms`);
    return { problems, worst };
  } catch (error) {
    return { problems: [...problems, `error: ${error.message}`], worst: Infinity };
  } finally {
    ref.done();
    svg.remove();
  }
}

/** Whether the file's own media query shows the group this browser's setting asks for. */
function mediaQueryCase(text) {
  const doc = lab.contentDocument;
  const svg = doc.importNode(
    new DOMParser().parseFromString(text, 'image/svg+xml').documentElement,
    true,
  );
  doc.body.append(svg);
  try {
    const [motion, second] = svg.querySelectorAll(':scope > g');
    const shown = (g) => doc.defaultView.getComputedStyle(g).display !== 'none';
    const ok = shown(motion) === !osReduced && shown(second) === osReduced;
    return ok ? [] : [`with reduced motion ${osReduced ? 'on' : 'off'} the wrong group shows`];
  } finally {
    svg.remove();
  }
}

function checkSvg(item, data, text) {
  const results = [];
  for (const reduced of [false, true]) {
    for (const direction of BACKWARDS.has(item.trigger) ? ['play', 'reverse'] : ['play']) {
      const { problems } = smilCase(item, data, text, reduced, direction);
      const label = `${reduced ? 'reduced' : 'full'} motion, ${direction === 'play' ? 'forwards' : 'back'}`;
      results.push({ label, problems });
    }
  }
  results.push({ label: 'reduced-motion media query', problems: mediaQueryCase(text) });
  return results;
}

// --- HTML + runtime and React, live ----------------------------------------------------

/** Loads a page in the visible stage frame and waits until `ready(window)` says so. */
async function loadStage(url, ready) {
  stage.src = url;
  await new Promise((r) => stage.addEventListener('load', r, { once: true }));
  for (let i = 0; i < 200 && !ready(stage.contentWindow); i++) await sleep(25);
  await frame();
  return stage.contentWindow;
}

/**
 * Runs `actions` (each starts a run) on a live icon and checks each against the reference:
 * it moves on the way (when the reference does), then rests where the reference rests.
 * Frames are polled rather than slept through, so a slow frame doesn't fail a run.
 */
async function live(svg, data, reduced, actions) {
  const ref = reference(data, reduced);
  const problems = [];
  try {
    for (const { label, act, start, already } of actions) {
      const before = looks(svg);
      act();
      start(ref.player);
      const { duration, moves } = ref.settle();
      const end = looks(ref.svg);
      // An appear icon started on its own when it came into view; only its end is checked.
      let moved = already || !moves;
      let off = Infinity;
      const began = performance.now();
      while (performance.now() - began < duration + 2000) {
        await frame();
        const now = looks(svg);
        moved ||= worstOf(now, before) > TOLERANCE;
        off = worstOf(now, end);
        if (moved && off <= TOLERANCE && performance.now() - began >= duration) break;
      }
      if (!moved) problems.push(`${label}: didn't move`);
      if (off > TOLERANCE) problems.push(`${label}: ends off by ${off.toFixed(3)}`);
      // Settled: let the player finish its own last frame before the next run.
      await sleep(100);
    }
  } catch (error) {
    problems.push(`error: ${error.message}`);
  } finally {
    ref.done();
  }
  return problems;
}

/** A loop: it should keep moving. */
async function keepsMoving(svg) {
  const seen = [];
  for (let i = 0; i < 4; i++) {
    seen.push(looks(svg));
    await sleep(130);
  }
  const moved = seen.slice(1).some((l) => worstOf(l, seen[0]) > TOLERANCE);
  return moved ? [] : ['loop: not moving (is the frame on screen?)'];
}

const pointer = (win, el, type) => el.dispatchEvent(new win.PointerEvent(type, { bubbles: false }));

/** The runs a person would make, for an icon in a button (or with a Play control). */
function actionsFor(trigger, win, target, handle) {
  const play = (p) => p.play();
  const back = (p) => p.reverse();
  if (trigger === 'click') return [{ label: 'click', act: () => target.click(), start: play }];
  if (trigger === 'appear') {
    return [{ label: 'appear', act: () => {}, start: play, already: true }];
  }
  if (trigger === 'hover') {
    return [
      { label: 'pointer in', act: () => pointer(win, target, 'pointerenter'), start: play },
      { label: 'pointer out', act: () => pointer(win, target, 'pointerleave'), start: back },
    ];
  }
  if (trigger === 'toggle') {
    return [
      { label: 'click', act: () => target.click(), start: play },
      { label: 'click again', act: () => target.click(), start: back },
    ];
  }
  // manual
  const runs = [
    { label: 'play', act: () => (handle ? handle.play() : target.click()), start: play },
  ];
  if (handle) runs.push({ label: 'reverse', act: () => handle.reverse(), start: back });
  return runs;
}

async function checkHtml(item, data) {
  const win = await loadStage(item.html, (w) => w.document?.readyState === 'complete');
  const doc = win.document;
  const svg = doc.getElementById(`${item.base}-icon`);
  if (item.trigger === 'loop') return [{ label: 'loops', problems: await keepsMoving(svg) }];
  const target = INTERACTIVE.has(item.trigger)
    ? doc.getElementById(`${item.base}-icon-button`)
    : doc.getElementById(`${item.base}-icon-play`);
  const problems = await live(svg, data, osReduced, actionsFor(item.trigger, win, target, null));
  return [{ label: `plays (reduced motion ${osReduced ? 'on' : 'off'})`, problems }];
}

async function checkReact(item, data, win) {
  const doc = win.document;
  const box = doc.querySelector(`[data-key="${item.key}"]`);
  const svg = box.querySelector('svg');
  const handle = win.iconTweenCheck.handles[item.key];
  const results = [];
  if (item.trigger === 'loop') {
    results.push({ label: 'loops', problems: await keepsMoving(svg) });
  } else {
    const target = box.querySelector('button');
    const problems = await live(
      svg,
      data,
      osReduced,
      actionsFor(item.trigger, win, target, handle),
    );
    results.push({ label: `plays (reduced motion ${osReduced ? 'on' : 'off'})`, problems });
  }
  // The second copy: reducedMotion="reduce", played through its ref.
  const reducedSvg = doc.querySelector(`[data-key="${item.key}:reduced"] svg`);
  const reducedHandle = win.iconTweenCheck.handles[`${item.key}:reduced`];
  const problems = await live(
    reducedSvg,
    data,
    true,
    actionsFor('manual', win, null, reducedHandle),
  );
  results.push({ label: 'reducedMotion="reduce", by ref', problems });
  return results;
}

// --- The page --------------------------------------------------------------------------

const FORMATS = [
  ['svg', 'SVG + SMIL'],
  ['html', 'HTML + runtime'],
  ['react', 'React'],
];
const report = [];

function row(item) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<th scope="row">${item.name}<small>${item.trigger}</small></th>`;
  for (const [format] of FORMATS) {
    const td = document.createElement('td');
    td.dataset.format = format;
    td.textContent = '…';
    tr.append(td);
  }
  $('#results tbody').append(tr);
  return tr;
}

function show(tr, item, format, results) {
  const td = tr.querySelector(`[data-format="${format}"]`);
  const failed = results.filter((r) => r.problems.length);
  td.className = failed.length ? 'fail' : 'pass';
  td.innerHTML = `<details><summary>${failed.length ? '✗' : '✓'} ${results.length - failed.length}/${results.length}</summary><ul>${results
    .map(
      (r) =>
        `<li>${r.problems.length ? '✗' : '✓'} ${r.label}${r.problems.map((p) => `<br><small>${p}</small>`).join('')}</li>`,
    )
    .join('')}</ul></details>`;
  for (const r of results) {
    report.push(
      `${r.problems.length ? 'FAIL' : 'pass'}  ${item.key}  ${format}  ${r.label}${r.problems.length ? `: ${r.problems.join('; ')}` : ''}`,
    );
  }
}

function gallery(item, text) {
  const figure = document.createElement('figure');
  figure.innerHTML = `<div class="pair"><span class="inline"></span><img alt="" width="48" height="48"></div><figcaption>${item.name}<small>${item.trigger}</small></figcaption>`;
  figure.querySelector('.inline').innerHTML = text;
  figure.querySelector('img').src = item.svg;
  $('#gallery').append(figure);
}

function browserName() {
  const ua = navigator.userAgent;
  if (/Firefox\/(\S+)/.test(ua)) return `Firefox ${RegExp.$1}`;
  if (/Edg\/(\S+)/.test(ua)) return `Edge ${RegExp.$1}`;
  if (/Chrome\/(\S+)/.test(ua)) return `Chrome ${RegExp.$1}`;
  if (/Version\/(\S+).*Safari/.test(ua)) return `Safari ${RegExp.$1}`;
  return ua;
}

async function main() {
  const status = $('#status');
  const manifest = await (await fetch('manifest.json')).json();
  await new Promise((r) => {
    if (lab.contentDocument?.readyState === 'complete') r();
    else lab.addEventListener('load', r, { once: true });
  });
  const items = await Promise.all(
    manifest.map(async (item) => ({
      item,
      data: (await (await fetch(item.json)).json()).animation,
      svg: await (await fetch(item.svg)).text(),
      tr: row(item),
    })),
  );
  items.forEach(({ item, svg }) => gallery(item, svg));
  $('#browser').textContent = `${browserName()} · reduced motion ${osReduced ? 'on' : 'off'}`;
  const started = performance.now();

  for (const { item, data, svg, tr } of items) {
    status.textContent = `SVG + SMIL: ${item.name}`;
    await frame();
    show(tr, item, 'svg', checkSvg(item, data, svg));
  }
  for (const { item, data, tr } of items) {
    status.textContent = `HTML + runtime: ${item.name} (keep this tab in front)`;
    show(tr, item, 'html', await checkHtml(item, data));
  }
  const win = await loadStage('react/index.html', (w) => !!w.iconTweenCheck);
  for (const { item, data, tr } of items) {
    status.textContent = `React: ${item.name} (keep this tab in front)`;
    show(tr, item, 'react', await checkReact(item, data, win));
  }

  const fails = report.filter((l) => l.startsWith('FAIL')).length;
  const seconds = ((performance.now() - started) / 1000).toFixed(0);
  status.textContent = fails
    ? `${fails} of ${report.length} checks failed (${seconds} s). Copy the report below.`
    : `All ${report.length} checks passed (${seconds} s).`;
  status.className = fails ? 'fail' : 'pass';
  $('#report').value = [
    `IconTween export check · ${$('#browser').textContent}`,
    navigator.userAgent,
    '',
    ...report,
  ].join('\n');
  document.documentElement.dataset.done = fails ? 'fail' : 'pass';
}

$('#copy').addEventListener('click', () => navigator.clipboard.writeText($('#report').value));
$('#replay').addEventListener('click', () => {
  document.querySelectorAll('#gallery img').forEach((img) => {
    img.src = `${img.src.split('?')[0]}?${Date.now()}`;
  });
  document.querySelectorAll('#gallery .inline svg').forEach((svg) => svg.setCurrentTime(0));
});
main().catch((error) => {
  $('#status').textContent = `The check stopped: ${error.message}`;
  $('#status').className = 'fail';
  throw error;
});
