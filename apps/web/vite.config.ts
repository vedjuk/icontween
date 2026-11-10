import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { bundleRuntime } from '@icontween/runtime/bundle';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const RUNTIME_ID = 'virtual:icontween-runtime';
const runtimeDir = fileURLToPath(new URL('../../packages/runtime/', import.meta.url));

/**
 * `virtual:icontween-runtime`: the runtime as the files exports ship (decision 016), built
 * from the same source the preview imports, so preview and export can't drift (rule 9).
 */
function icontweenRuntime(): Plugin {
  return {
    name: 'icontween-runtime',
    resolveId: (id) => (id === RUNTIME_ID ? `\0${RUNTIME_ID}` : undefined),
    async load(id) {
      if (id !== `\0${RUNTIME_ID}`) return;
      for (const file of readdirSync(`${runtimeDir}src`))
        this.addWatchFile(`${runtimeDir}src/${file}`);
      const typesFile = `${runtimeDir}types/icontween.d.ts`;
      this.addWatchFile(typesFile);
      const [esm, iife, minified] = await Promise.all([
        bundleRuntime({ format: 'es' }),
        bundleRuntime({ format: 'iife' }),
        bundleRuntime({ format: 'es', minify: true }),
      ]);
      return [
        `export const runtimeEsm = ${JSON.stringify(esm)};`,
        `export const runtimeIife = ${JSON.stringify(iife)};`,
        `export const runtimeTypes = ${JSON.stringify(readFileSync(typesFile, 'utf8'))};`,
        `export const runtimeMinifiedGzip = ${gzipSync(minified, { level: 9 }).length};`,
      ].join('\n');
    },
  };
}

export default defineConfig({
  plugins: [react(), icontweenRuntime()],
});
