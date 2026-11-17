/* global build */
import { launch } from './common.mjs';
import { readFileSync } from 'node:fs';
const menu = JSON.parse(readFileSync('icons.json', 'utf8')).find((i) => i.id === 'lucide-menu').svg;
const b = await launch();
const p = await b.newPage({ viewport: { width: 1200, height: 420 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5190/ba.html');
await p.evaluate(([s, t]) => build(s, t), [menu, [0, 0.03, 0.06, 0.1, 0.3]]);
await p.waitForTimeout(200);
await p.screenshot({ path: 'out-before-after.png' });
await b.close();
