# README media: shot list

`hero.svg` is generated, not recorded: `pnpm readme-hero` rebuilds it from
`examples/starters.icontween.json` with IconTween's own SVG export. Run it again after tuning
the starters.

The root `README.md` has commented-out image lines for the three GIFs below. Record them, save
them here with these exact names, then uncomment the lines in the README.

General:

- Record at 2× (Retina), export **800 px wide** (1600 px source is fine; GitHub scales it).
  16:10 or 16:9, the same for all three.
- **6–12 seconds**, looping cleanly (end where you started). Keep each under ~3 MB: 15–20 fps,
  a limited palette, no mouse-trail effects.
- Light theme, browser chrome cropped out, the cursor visible. Reduced motion off.
- A clean project: no half-finished icons in the library. Use a Lucide icon or one of your own.

| File          | What to record                                                                                                                                                                                | Length   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `prepare.gif` | Editor welcome. Drop one SVG (ideally with a circle or rect, so the report shows conversions). The import report, then the original over the prepared copy in the Prepare step.               | ~8 s     |
| `edit.gif`    | Pick a purpose (state change), press "Clone A → B", drag two or three points or handles with the onion skin on, then play the morph on hover in the preview. The heart of it: take your time. | ~10–12 s |
| `export.gif`  | Open Export code. Switch SVG → HTML (the exported page playing in the frame) → React, then Copy.                                                                                              | ~6–8 s   |
