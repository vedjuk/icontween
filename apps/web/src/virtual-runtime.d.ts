/** The runtime as exports ship it; built by the icontween-runtime plugin in vite.config.ts. */
declare module 'virtual:icontween-runtime' {
  /** ES module, shipped as icontween.js next to React components. */
  export const runtimeEsm: string;
  /** Classic script defining `IconTween`, inlined into HTML exports. */
  export const runtimeIife: string;
  /** icontween.d.ts, the types for runtimeEsm. */
  export const runtimeTypes: string;
  /** Gzipped bytes of the minified runtime: what it adds to an app after its bundler runs. */
  export const runtimeMinifiedGzip: number;
}
