/* global setupGrid, gridTime */
import { launch } from './common.mjs';
import { readFileSync } from 'node:fs';
const b = await launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:5190/');
await p.evaluate(
  ([i]) => {
    setupGrid(i, 0.22);
    gridTime(1.05, true);
  },
  [JSON.parse(readFileSync('icons.json', 'utf8'))],
);
await p.waitForTimeout(200);
await p.screenshot({ path: 'out-thumb.png' });
await b.close();
