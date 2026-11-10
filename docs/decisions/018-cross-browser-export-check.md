# 018 — Cross-browser export check

Date: 2026-11-10

## Context

M4 asks for a cross-browser check of every export (Safari, Chrome, Firefox), and its
done-when needs the React component and the HTML + runtime file to work in a fresh Vite app
and a plain HTML page. Claude can drive Chrome but not Safari (it needs a developer setting
turned on) and Firefox isn't installed. The owner chose self-checking pages over adding
Playwright and its browser downloads. Playwright's WebKit isn't real Safari anyway.

## Decision

- **`pnpm export-check`** (`packages/runtime/export-check/`) writes every starter in every
  format into `out/` (gitignored) and serves it on http://localhost:5180 with a small
  static server (`serve.js`, no dependencies):
  - `svg/`, `html/`, `json/`: the files exactly as the Export dialog makes them, with the
    runtime built the same way (`bundleRuntime`).
  - `react/`: **a fresh Vite app**: Vite's `react-ts` template (strict `tsc -b`, then
    `vite build`) with every exported component, `icontween.js` and `icontween.d.ts`
    copied next to them. Installed once from the pnpm store with `--ignore-workspace`, so
    it resolves packages like a developer's own app, not through workspace links.
- **The check page compares each export with the runtime in the browser that opens it**,
  using what that browser renders: six points along each path (`getPointAtLength`, with
  the transform from `getScreenCTM`), and opacity and dashes from computed style. The
  reference is the runtime on a fake clock in a hidden frame. Tolerance 0.1 viewBox units.
  - **SVG + SMIL**: paused and seeked (`pauseAnimations`, `setCurrentTime`) to 61 times
    per run, like `smil.test.ts`, but with the browser's own SMIL engine. Full and reduced
    motion (the reduced group shown by an inline style), forwards and back. The trigger is
    fired as an event (click, mouseover/mouseout, the toggle's two hit areas,
    `beginElement` for manual) and must start its timer at that moment; the toggle's back
    area must be visible when it takes the click. The file's own media query must show the
    group that matches the system's reduced-motion setting.
  - **HTML + runtime and React**: each runs for real in a visible frame (loop and appear
    wait to be seen). The check presses the button (pointer events for hover) or calls the
    ref, polls frames, and needs the icon to move on the way (when the reference does) and
    to rest where the reference rests. Loops must keep moving. React also checks a second
    copy with `reducedMotion="reduce"`, played by ref.
  - Results per starter and format, plus a plain-text report to copy into chat.
- **By eye**: the gallery shows each SVG inline and as `<img>` with Replay, for what a
  check can't judge: smoothness, flashes, and `<img>` playback (which scripts can't read).
- **The check was checked**: a curve changed in one SVG fails by 5.1 units, one state's
  coordinates moved by 1 fails by 1.4, in every starter that morphs.

## Result

All 84 checks pass in Chrome 152, Safari 26.5 and Firefox 159 (reduced motion off).

## Alternatives

- Playwright with WebKit and Firefox builds: automatic, but a large dev dependency, about
  300 MB of browsers, and WebKit there isn't the Safari people use.
- Turning on Safari's remote automation (`safaridriver`): a system setting the owner would
  have to change; the pages work without it.
- Comparing screenshots: needs a renderer that can be paused at a time, which `<img>`
  SMIL can't, and fails on anti-aliasing differences between browsers.

## Known limits

- Reduced motion for HTML exports follows the system setting, so it's checked by turning
  on Reduce Motion and reloading. The SMIL reduced group and React's `reduce` prop are
  checked either way.
- Synthetic events start the runtime and SMIL the same way a person does, but don't prove
  hover feel or the keyboard; those stay by hand.
- Background tabs slow frames; the page asks to stay in front while it runs (~45 s).
