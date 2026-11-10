/**
 * Builds the runtime into one JavaScript file, the same code the editor preview runs
 * (rule 9). Used by the size report and by the editor's exports (decision 016).
 *
 * - `es`: an ES module (`icontween.js`), shipped next to exported React components.
 * - `iife`: a classic script that defines a global `IconTween`, inlined into exported HTML
 *   so the page also works when opened straight from disk.
 *
 * Unminified builds keep the source's doc comments, so the shipped file stays readable
 * (rule 7). Bundlers minify it in the app that uses it.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = fileURLToPath(new URL('../src/index.ts', import.meta.url));

/** The runtime's version, read from `RUNTIME_VERSION` in src/index.ts. */
export function runtimeVersion() {
  const source = readFileSync(entry, 'utf8');
  return /RUNTIME_VERSION = '([^']+)'/.exec(source)?.[1] ?? '0.0.0';
}

/**
 * @param {{ format: 'es' | 'iife', minify?: boolean }} options
 * @returns {Promise<string>} the bundled code, starting with a licence banner
 */
export async function bundleRuntime({ format, minify = false }) {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    build: {
      lib: { entry, formats: [format], name: 'IconTween', fileName: 'icontween' },
      minify,
      // Vite keeps whitespace in ES library builds; minify fully for a realistic number.
      rolldownOptions: minify ? { output: { minify: true } } : {},
      write: false,
    },
  });
  const code = (Array.isArray(result) ? result[0] : result).output[0].code;
  const banner = [
    '/*!',
    ` * IconTween runtime ${runtimeVersion()} · MIT License · https://icontween.vedjuk.com`,
    ' * Plays IconTween animations on inline SVG, and follows prefers-reduced-motion.',
    ' */',
    '',
  ].join('\n');
  return banner + code.trimEnd() + '\n';
}
