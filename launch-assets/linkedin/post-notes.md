# LinkedIn post: fact check and suggested text

## Suggested text

> Icons rarely just sit there. Play turns into pause, a menu into a close, a bell gives a little ring.
>
> I wanted a simple way to make that motion without hand-writing every keyframe, so I built IconTween.
>
> Bring your own SVG icon and give it state-based motion: start from a purpose like feedback or state change, which sets the trigger, timing and reduced motion for you, then shape it, all the way down to individual points. Export small, readable code you can hand straight to a developer: an SVG with no JavaScript, an HTML page or a React component. Everything runs in your browser. Nothing is uploaded.
>
> I’ve loved interface motion since my Flash days, and I missed a tool this direct. I built it for the few icons in a product that deserve a crafted moment, and for the developer who has to ship them.
>
> Try it on a desktop browser: icontween.vedjuk.com
> It’s free and open source. Feedback welcome, especially from anyone who ships icons in production.
>
> #motiondesign #uidesign #designengineering

## What changed, and why

1. **"ready-made presets" → "a purpose … which sets the trigger, timing and reduced motion for
   you".** IconTween's presets are purposes (Feedback, State change, Attention,
   Discoverability, Delight) plus sequence patterns (Hold, Return, Return ×2). They set
   _how_ it plays, but not _what_ moves: nothing turns your icon into an X for you. "Ready-made
   presets" reads like a motion library you apply to any icon, and people will look for one.
   The other thing you could call presets is the twelve animated starters, but those are
   Lucide icons, not your own.
2. **"go all the way down" now follows the purpose ("then shape it")**, because a purpose
   doesn't replace shaping. It's where you start, before you move points.
3. **Named the export formats.** "An SVG with no JavaScript" is the most surprising, concrete
   claim and it's true (SMIL, 1.2 KB gzipped for menu → close). The React component is
   1.7 KB gzipped plus the 4 KB runtime.
4. **"Nothing is uploaded"** sits next to "runs in your browser". It's the site's own line
   and it's what privacy-minded readers want to hear.
5. **"Try it on a desktop browser".** Most LinkedIn clicks come from phones, and below 48rem
   `/editor` shows the read-only viewer, by design (decision 024). Saying so up front saves the
   "it doesn't work on my phone" replies.
6. **"free and open source"**: MIT, on GitHub. It's true, and it's a reason to click.

Everything else checks out: play ↔ pause, menu ↔ close and the bell ring are all starters;
state-based motion, moving individual points (anchors and handles), and "runs in your browser"
are accurate. The Flash line matches the project brief.

## Notable features the post leaves out (pick one or two at most)

- **Reduced motion is designed into every export.** For each icon you choose whether it jumps,
  fades or stays still when the OS asks for less motion.
- **The SVG export needs no JavaScript.** It's plain SMIL, and loop/appear even play as an
  `<img>`.
- **Preview = export.** The editor plays with the same 4 KB runtime that ships, and every
  format is checked against it in Safari, Chrome and Firefox.
- **Twelve starters** you can open and take apart in the editor.
- More than point moves: rotate, scale with a pivot, opacity, stroke draw, springs, multi-state
  sequences (A → B → C) and stagger.
- **Previews at 48, 24 and 16 px** with different stroke widths, on light and dark.
- **Share links** carry the whole animation in the URL. There are also project files and
  auto-save, with no account.

## One line on why it was built (from the project brief and history)

> If every icon moves, none is special. I wanted a tool for the handful that earn it, with
> output a developer would actually ship.

(The suggested text above uses a shorter version: "for the few icons in a product that deserve
a crafted moment, and for the developer who has to ship them." That's the README's own framing.)
