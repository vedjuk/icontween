/* global setupGrid, gridTime, console */
import { launch } from './common.mjs';
import { readFileSync } from 'node:fs';
const icons = JSON.parse(readFileSync('icons.json', 'utf8'));
const b = await launch();
// Hero
{
  const p = await b.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  await p.goto('http://localhost:5190/');
  await p.evaluate(
    ([i]) => {
      setupGrid(i, 0.22);
      gridTime(3.7, true);
    },
    [icons],
  );
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'out-hero.png' });
  await p.close();
}
// Editor + export, the finished menu starter opened from the landing page
{
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  const p = await ctx.newPage();
  await p.goto('http://localhost:5173/');
  await p.waitForTimeout(800);
  const card = p.locator('.landing-card').filter({ hasText: 'Menu' }).first();
  await card.locator('.landing-edit').click();
  await p.waitForURL(/editor/);
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: 'B', exact: true }).first().click();
  await p.waitForTimeout(300);
  await p.locator('.inspector').locator('.icon-item', { hasText: 'el-1' }).click();
  await p.waitForTimeout(300);
  await p.locator('.preview-target').click();
  await p.waitForTimeout(900);
  await p.mouse.move(1430, 890);
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'out-editor-raw.png' });
  console.log(
    await p
      .locator('.inspector')
      .innerText()
      .then((t) => t.slice(0, 600)),
  );
  await p.getByRole('button', { name: 'Export code' }).click();
  await p.waitForTimeout(600);
  await p.getByRole('dialog').getByRole('button', { name: 'SVG (no JS)' }).click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'out-export-raw.png' });
  console.log(await p.locator('.export-size').innerText());
  await p.getByRole('dialog').getByRole('button', { name: 'React' }).click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'out-export-react-raw.png' });
  console.log(await p.locator('.export-size').innerText());
  await ctx.close();
}
await b.close();
