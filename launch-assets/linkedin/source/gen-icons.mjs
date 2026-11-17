/* global console */
// Builds icons.json: each starter as IconTween's own SVG+SMIL export, switched to loop.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const root = '/Users/vedran/Documents/GitHub/icontween';
const req = createRequire(root + '/packages/runtime/package.json');
const { JSDOM } = await import(req.resolve('jsdom'));
const { runnerImport } = await import(req.resolve('vite'));
globalThis.DOMParser = new JSDOM('').window.DOMParser;
const { module: core } = await runnerImport(root + '/packages/core/src/index.ts', {
  configFile: false,
  logLevel: 'silent',
});
const read = core.parseProject(readFileSync(root + '/examples/starters.icontween.json', 'utf8'));
const project = read.value;
const out = project.animations.map((a) => {
  const returns = a.sequence.steps.at(-1).to === a.states[0].id;
  const looping = {
    ...a,
    trigger: { type: 'loop' },
    sequence: {
      ...a.sequence,
      repeat: returns ? 'loop' : 'ping-pong',
      restBetweenLoops: returns ? 900 : 900,
    },
  };
  const svg = core
    .exportSvg(looping, project.motionTokens, { size: 96 })
    .text.replace(/currentColor/g, '#1d1b26');
  return { id: a.id, name: a.name, purpose: a.purpose, svg };
});
writeFileSync('icons.json', JSON.stringify(out, null, 1));
console.log(out.map((o) => o.id + ' ' + o.name + ' ' + o.purpose).join('\n'));
