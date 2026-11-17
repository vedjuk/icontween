# LinkedIn launch assets

Recorded 2026-11-17 from the local dev server (same code as icontween.vedjuk.com), light theme,
fresh browser profile, the Lucide starters only.

| File                               | What it is                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `icontween-linkedin.mp4`           | 19.6 s, 1080×1350 (4:5), H.264 High, 30 fps, yuv420p, no audio, 2.4 MB. Loops cleanly.    |
| `icontween-linkedin-thumbnail.png` | 2160×2700. The video's first and last frame, for LinkedIn's custom thumbnail.             |
| `icontween-hero.png`               | 2160×2700. The twelve starters, caught mid-animation (menu half-crossed, bell mid-ring).  |
| `icontween-editor.png`             | 2880×1800. Menu ↔ close starter in the editor: state B, onion skin, State change purpose. |
| `icontween-export.png`             | Export dialog, SVG (no JS): the code and "menu.svg · 8.4 KB, 1.2 KB gzipped".             |
| `icontween-export-react.png`       | Export dialog, React: the typed component's header and imports. 6.4 KB, 1.7 KB gzipped.   |
| `icontween-before-after.png`       | 2400×840. menu → close: state A, three in-betweens, state B, from the real SVG export.    |

## Video storyboard (as recorded)

- **0–4.6 s**: wordmark, tagline, the twelve starters animating (IconTween's own SVG + SMIL
  export, looping), URL pill.
- **4.6–6.3 s**, "Step 1 · Start from a purpose": Purpose switches to State change, and the
  summary updates (Toggle · base · Standard · Hold).
- **6.3–10.6 s**, "Step 2 · Shape any point by hand": Clone A → B, select the top line, drag
  its right end down over the onion skin.
- **10.6–12.6 s**, "Step 3 · Preview it at real size": click the preview tile, and the morph
  plays at 48/24/16.
- **12.6–17.2 s**, "Step 4 · Export small, readable code": Export code → SVG (no JS), zoom to
  the code, scroll from the header comment to the `<path>` and `<animate>`.
- **17.2–19.6 s**: back to the grid, still (same as frame one, so the loop is seamless).

The export in the video is the icon edited on camera (one point of the top line moved), so it
reads "menu.svg · 4.1 KB, 1.0 KB gzipped". `icontween-export.png` is the unedited menu ↔ close
starter, where all three lines move: 8.4 KB, 1.2 KB gzipped.

The editor and export are the real app in a zoomed iframe. The captions, the drawn cursor and
the click ripples are added by the stage page. The video doesn't show a preset beyond the
purpose picker, because that's what IconTween's presets are (see the post notes).

## Rebuild

`source/` has the stage page and Playwright scripts. With `pnpm dev` running, from a folder
where `playwright` is installed (they use the Chromium in `~/Library/Caches/ms-playwright`):
`node serve.mjs &`, `node gen-icons.mjs`, `node record.mjs`, then encode the screencast frames:

```bash
ffmpeg -f concat -safe 0 -i frames.txt -vf "fps=30,scale=1080:1350:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p" -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:v libx264 -preset slow -crf 17 -profile:v high -level 4.0 -movflags +faststart -an icontween-linkedin.mp4
```

`stills.mjs`, `stills2.mjs`, `ba.mjs` and `thumb.mjs` make the PNGs.
