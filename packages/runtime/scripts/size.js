/**
 * Reports the runtime's size: one minified ES module bundle, raw and gzipped.
 * Usage: pnpm --filter @icontween/runtime size
 */
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const result = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    lib: { entry, formats: ['es'], fileName: 'icontween' },
    minify: true,
    // Vite keeps whitespace in ES library builds; minify fully for a realistic number.
    rolldownOptions: { output: { minify: true } },
    write: false,
  },
});
const output = (Array.isArray(result) ? result[0] : result).output[0];
const bytes = Buffer.byteLength(output.code);
const gzipped = gzipSync(output.code, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(2)} KB`;
console.log(`runtime: ${kb(bytes)} minified, ${kb(gzipped)} gzipped`);
