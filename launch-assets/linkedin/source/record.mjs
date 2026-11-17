/* global setupGrid, gridTime, svgs, scene, caption, shot, cursor, ripple, document, getComputedStyle, setTimeout, console, process, Buffer */
// Records the LinkedIn video: stage.html (1080x1350) framing the real app in an iframe.
import { launch } from './common.mjs';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const DRY = process.argv.includes('--dry');
const OUT = 'frames';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = 1.05,
  STAGGER = 0.22;

const b = await launch();
const ctx = await b.newContext({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  reducedMotion: 'no-preference',
});
const p = await ctx.newPage();
await p.goto('http://localhost:5190/');
await p.evaluate(
  ([i, s, t]) => {
    setupGrid(i, s);
    gridTime(t, true);
  },
  [JSON.parse(readFileSync('icons.json', 'utf8')), STAGGER, T0],
);

// Prepare the app off-screen: menu icon, purpose Feedback (switched to State change on camera).
await p.evaluate(() => {
  document.getElementById('f').src = 'http://localhost:5173/editor#lucide-menu';
});
await sleep(2500);
const f = p.frames().find((x) => x.url().includes('5173'));
const purpose = f.locator('select').filter({ hasText: 'State change' });
await purpose.selectOption('feedback');
await p.evaluate(() => shot(262, 58, 838, true));
await sleep(500);

// Screencast
let frames = [];
const cdp = await ctx.newCDPSession(p);
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  frames.push({ t: metadata.timestamp, data });
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
let shots = 0;
const still = async (name) => {
  if (DRY) await p.screenshot({ path: `dry-${String(++shots).padStart(2, '0')}-${name}.png` });
};

// Cursor
let pos = [540, 1400];
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
async function moveTo(x, y, dur = 700) {
  const [x0, y0] = pos;
  const start = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - start) / dur);
    const e = ease(t);
    const cx = x0 + (x - x0) * e,
      cy = y0 + (y - y0) * e;
    await Promise.all([p.mouse.move(cx, cy), p.evaluate(([a, c]) => cursor(a, c), [cx, cy])]);
    if (t >= 1) break;
  }
  pos = [x, y];
}
async function click(x, y) {
  await p.evaluate(([a, c]) => ripple(a, c), [x, y]);
  await p.mouse.down();
  await sleep(70);
  await p.mouse.up();
}

let cam = { x: 262, y: 58, w: 838 };
const setShot = async (x, y, w, instant = false) => {
  cam = { x, y, w };
  await p.evaluate(([a, b, c, d]) => shot(a, b, c, d), [x, y, w, instant]);
};
// iframe CSS px -> stage px for the current (target) camera
const toStage = (ix, iy) => {
  const s = 1000 / cam.w;
  return [41.5 + (ix - cam.x) * s, 197.5 + (iy - cam.y) * s];
};
const rect = (loc) =>
  loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  });
const at = async (loc, dx = 0, dy = 0) => {
  const [x, y, w, h] = await rect(loc);
  return toStage(x + w / 2 + dx, y + h / 2 + dy);
};
const atVb = async (vx, vy) => {
  const [x, y, w] = await rect(f.locator('svg.canvas'));
  const u = w / 29.76;
  return toStage(x + (vx + 2.88) * u, y + (vy + 2.88) * u);
};
await f.addStyleTag({ content: '.canvas:focus:not(:focus-visible){outline:none}' });

await cdp.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 94,
  maxWidth: 1080,
  maxHeight: 1350,
  everyNthFrame: 1,
});
const t0 = Date.now();
const mark = (n) => console.log(((Date.now() - t0) / 1000).toFixed(2), n);

// 1. Grid comes alive (first frame = the paused end frame, for a clean loop)
await sleep(200);
await p.evaluate(() => cursor(-50, -50));
await sleep(300);
await p.evaluate(() => {
  for (const x of svgs()) x.unpauseAnimations();
});
mark('grid');
await sleep(1400);
await still('grid');
await sleep(2500);

// 2. Editor: pick a purpose
await setShot(545, 58, 555, true);
await p.evaluate(() => {
  caption('Step 1', 'Start from a purpose');
  scene('app');
  cursor(760, 1380, true);
});
pos = [760, 1380];
mark('editor');
await sleep(200);
let [x, y] = await at(purpose, -40);
await moveTo(x, y, 620);
await sleep(60);
await click(x, y);
await purpose.selectOption('state-change');
await sleep(700);
await still('purpose');

// Clone, select the top line, drag one point (camera and cursor move together)
await p.evaluate(() => caption('Step 2', 'Shape any point by hand'));
await setShot(252, 104, 555);
[x, y] = await at(f.getByRole('button', { name: /Clone A/ }));
await moveTo(x, y, 760);
await sleep(60);
await click(x, y);
await sleep(340);
[x, y] = await atVb(9, 5);
await moveTo(x, y, 520);
await sleep(60);
await click(x, y);
await sleep(300);
[x, y] = await atVb(20, 5);
await moveTo(x, y, 480);
await sleep(120);
await p.mouse.down();
await sleep(80);
[x, y] = await atVb(20, 19);
await moveTo(x, y, 900);
await sleep(80);
await p.mouse.up();
await sleep(300);
await still('dragged');

// Preview the morph at real size
await p.evaluate(() => caption('Step 2', 'Preview it at real size'));
await setShot(262, 58, 838);
[x, y] = await at(f.locator('.preview-target'), 0, 10);
await moveTo(x, y, 800);
await sleep(60);
await click(x, y);
await sleep(800);
await still('toggled');

// 3. Export
await p.evaluate(() => caption('Step 3', 'Export small, readable code'));
[x, y] = await at(f.getByRole('button', { name: 'Export code' }));
await moveTo(x, y, 650);
await sleep(60);
await click(x, y);
await sleep(300);
const svgBtn = f.getByRole('dialog').getByRole('button', { name: 'SVG (no JS)' });
[x, y] = await at(svgBtn);
await moveTo(x, y, 550);
await sleep(60);
await click(x, y);
await sleep(200);
// Frame the code and its size line
const code = f.locator('.export-code');
const [cx] = await rect(code);
const [, sy, , sh] = await rect(f.locator('.export-size'));
const W = 660,
  H = (1114 * W) / 1000;
await setShot(cx - 16, sy + sh + 12 - H, W);
await p.evaluate(() => cursor(0, 0, false));
await sleep(1150);
await still('export');
await code.evaluate((el) => {
  const lines = el.textContent.split('\n');
  const i = lines.findIndex((l) => l.includes('-motion">'));
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
  el.scrollTo({ top: Math.max(0, i * lh - 4), behavior: 'smooth' });
});
await sleep(1200);
await still('export-scrolled');

// 4. End frame: back to the grid, still
await p.evaluate((t) => {
  gridTime(t, true);
  scene('grid');
}, T0);
mark('end');
await sleep(1700);
mark('done');
const stopAt = Date.now() / 1000;
await cdp.send('Page.stopScreencast');
await sleep(300);
frames.sort((a, b) => a.t - b.t);
let list = '';
frames.forEach((fr, i) => {
  const n = `${OUT}/${String(i).padStart(5, '0')}.jpg`;
  writeFileSync(n, Buffer.from(fr.data, 'base64'));
  const d = i < frames.length - 1 ? frames[i + 1].t - fr.t : Math.max(0.04, stopAt - fr.t);
  list += `file '${n}'\nduration ${d.toFixed(4)}\n`;
});
list += `file '${OUT}/${String(frames.length - 1).padStart(5, '0')}.jpg'\n`;
writeFileSync('frames.txt', list);
console.log('frames', frames.length, 'span', (frames.at(-1).t - frames[0].t).toFixed(2));
await b.close();
