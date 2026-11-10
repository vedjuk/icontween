# 011 — Preview panel options: sizes, stroke widths, light/dark

Date: 2026-11-10

## Context

The brief asks for a preview panel that shows the animation at 16 / 24 / 48px, with stroke
width options and a light/dark background (brief §9, M3). Sizes were already there; this
part adds the other two. The preview must keep using the shipping runtime (rule 9).

## Decision

- **Both options are preview-only.** They live in the editor store, are not part of the
  animation and are not saved with it. They answer "how will this look in my product?",
  not "how is this icon built?".
- **Stroke width is restyled with CSS**, the way a developer would restyle an icon on a
  page (`path { stroke-width }` beats the presentation attribute). The runtime and the
  animation data are untouched, so the preview still equals the export. Paths with
  `stroke="none"` are left alone, and the options are disabled for fill-only icons.
- **Options are 1, 1.5, 2 and 2.5 on a 24-unit grid** (the common icon-set range), plus
  "Icon" for the width as designed. The label shows the designed width (the one most
  stroked elements use). Icons with another viewBox scale the value so it looks the same.
- **Light and dark use fixed colours**, not the app theme: the tile stands in for a light
  or a dark product UI. It starts on the app's theme. Icons drawn in `currentColor`
  follow the tile; hard-coded colours stay as they are, which is what a designer needs to
  see.
- Each size has a small label under it, and the options sit with their label above them so
  they fit the inspector's width.

## Alternatives

- A stroke-width option in the runtime: would need a schema or option change and a size
  cost, for something CSS already does. Revisit if the React wrapper gets a `strokeWidth`
  prop in M4; it can use the same CSS.
- Showing light and dark tiles side by side: doubles the players and the hover target;
  one tile with a switch is enough.
- `vector-effect: non-scaling-stroke` for "same pixels at every size": changes how icons
  normally scale, so the preview would stop matching real use.
