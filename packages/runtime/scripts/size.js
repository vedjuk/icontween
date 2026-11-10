/**
 * Reports the runtime's size: one minified ES module bundle, raw and gzipped.
 * Usage: pnpm --filter @icontween/runtime size
 */
import { gzipSync } from 'node:zlib';
import { bundleRuntime } from './bundle.js';

const kb = (n) => `${(n / 1024).toFixed(2)} KB`;
const report = (label, code) => {
  const bytes = Buffer.byteLength(code);
  const gzipped = gzipSync(code, { level: 9 }).length;
  console.log(`runtime (${label}): ${kb(bytes)}, ${kb(gzipped)} gzipped`);
};

report('minified', await bundleRuntime({ format: 'es', minify: true }));
report('readable, as exported', await bundleRuntime({ format: 'es' }));
