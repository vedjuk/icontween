# 004 — Comparing original and prepared icons with CSS masks

Date: 2026-11-09

## Context

The prepare screen must show the original icon "as-is" next to and on top of the prepared
clone, so the designer can confirm they match (brief §8, step 11). Originals are untrusted and
can hard-code any colour (`black`, `currentColor`, hex), which makes recolouring them for an
overlay awkward.

## Decision

- **Both versions render as CSS masks** (`mask-image: url(data:image/svg+xml,…)`) over a solid
  background colour. Image contexts never run scripts, and the mask only uses alpha, so any
  source colour shows up in the colour we choose.
- **The original is still sanitized first** (`sanitizeSvg()` in core). Defence in depth: the
  mask is safe on its own, and the CSP already blocks remote loads.
- **Three views:** overlay (grey original, vermilion prepared), difference (white on black
  with `mix-blend-mode: difference`, where matches cancel to black), and side by side.
- **Measured once in the browser:** all 18 Lucide sources rasterized at 480px (20× real
  size) have no pixel whose coverage differs by more than 50%. The remaining hairlines in
  difference view are curve edges smoothed a fraction of a pixel differently.
- **No router yet:** `/prepare` is picked by pathname in `main.tsx`. Both Vite and Cloudflare
  serve `index.html` for unknown paths.

## Alternatives

- Inline the sanitized SVG and override colours with CSS: breaks on fill-vs-stroke icons (a
  blanket `stroke:` override adds outlines to filled shapes).
- `<img>` tags: safe, but can't be recoloured, so overlay colours wouldn't be distinguishable.
