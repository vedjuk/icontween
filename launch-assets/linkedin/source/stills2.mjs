/* global console */
import { launch } from './common.mjs';
const b = await launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 1300 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
});
const p = await ctx.newPage();
await p.goto('http://localhost:5173/');
await p.waitForTimeout(800);
await p
  .locator('.landing-card')
  .filter({ hasText: 'Menu' })
  .first()
  .locator('.landing-edit')
  .click();
await p.waitForURL(/editor/);
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Export code' }).click();
await p.waitForTimeout(600);
const shot = async (fmt, path) => {
  await p.getByRole('dialog').getByRole('button', { name: fmt }).click();
  await p.waitForTimeout(700);
  // play the inline export so it shows the close state
  const bb = await p.locator('.export-dialog').boundingBox();
  const m = 28;
  await p.mouse.move(5, 5);
  await p.screenshot({
    path,
    clip: { x: bb.x - m, y: bb.y - m, width: bb.width + 2 * m, height: bb.height + 2 * m },
  });
  console.log(fmt, bb);
};
await shot('SVG (no JS)', 'out-export-svg.png');
await shot('React', 'out-export-react.png');
await b.close();
