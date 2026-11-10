/** Types for bundle.js, which is plain JavaScript so Node can run it without a build. */
export function runtimeVersion(): string;
export function bundleRuntime(options: {
  format: 'es' | 'iife';
  minify?: boolean;
}): Promise<string>;
