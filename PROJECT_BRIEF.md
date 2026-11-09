# IconTween — Project Brief

> **Motion for the moments that matter.**
> A browser-based tool for designers to craft purposeful, state-based animations for individual SVG icons, and hand them off as clean, developer-friendly code.

This document is the handover for starting the project. It explains **why** the project exists, **what** we're building (and not building), the **core rules**, the **data model**, and the **milestones**. Read it fully before writing code. The short, non-negotiable rules are repeated in `CLAUDE.md`.

---

## 1. Context and goals

**Owner:** Vedran (designer, web/motion background since the Flash era).
**Nature:** Personal, open-source portfolio project (MIT). Not a commercial product.
**Goals, in order:**
1. A polished, live web app at **icontween.com** that shows design judgment and craft.
2. A clean public GitHub repo with a great README.
3. Material for a portfolio case study: decisions, process, and how the work was done with Claude.

**Success means** a hiring manager can open the site, understand the idea in 30 seconds, play with a beautiful example, and open the editor with an icon already loaded.

**Pace:** evenings and weekends. Work in small, shippable increments. Each milestone should leave the app in a working, deployable state.

---

## 2. Philosophy (this shapes every decision)

- **Motion needs a purpose.** Animation is justified by feedback, state change, attention, discoverability or (rarely) delight. Never decoration for its own sake.
- **If every icon moves, none is special.** A real product might use ~15–20 cheap transitions and only ~5–10 crafted morphs. The tool is designed for *the few moments that matter*, not for animating whole icon sets.
- **Constraints are a feature.** Designers obsess over details, but they also need guardrails so the result is something developers will accept and ship. Opinionated defaults, visible overrides.
- **Respect the user.** Reduced motion is designed, not an afterthought. No unskippable or endless attention-grabbing motion by default.
- **The unit of work is the moment**, not the icon set.

---

## 3. Target user

**Primary:** product/UI designers who already have an icon set (third-party like Lucide, custom-made, or a mix) and occasionally need a crafted animated icon for a specific UI moment.

**Secondary:** the developer who receives the result. The output must be small, readable and easy to integrate.

---

## 4. Scope

### In scope for v1
- 100% **client-side static web app**: no backend, no accounts. Icons never leave the user's machine.
- **Starter set** of 10–12 hand-picked, pre-prepared and pre-animated example icons (from Lucide, ISC license).
- **Library:** user adds their own icons (upload multiple SVG files / drag and drop / paste SVG code). Shown as-is, unprocessed.
- **Prepare for animation:** user picks one icon → it's *cloned* into a normalized, animation-ready version. Original untouched.
- **State editor:** state A = prepared icon; clone into B, C, D…; move nodes/handles; set element transforms (rotate/translate/scale with pivot), opacity, and stroke draw (pathLength).
- **Transitions and sequences:** duration, easing (curves + springs), per-element delay/stagger; pattern templates (A→B, A→B→A, A→B→C→A, …).
- **Triggers and behaviour:** hover, click, toggle (two stable states), loop, on-appear, manual (programmatic).
- **Purpose tag** per animation (feedback / state change / attention / discoverability / delight) with sensible defaults.
- **Reduced-motion variant** per animation (explicitly chosen: instant swap / fade / none).
- **Live preview** at 16, 24 and 48px and different stroke widths; scrubbable timeline.
- **Export:** standalone SVG (+SMIL where possible), SVG + tiny runtime, and a React component. Copy-to-clipboard and download.
- **Persistence:** auto-save to browser storage (IndexedDB), project export/import as `.icontween.json`, **share links** with the animation encoded in the URL.
- **Showcase landing page** with the starter examples animating live.

### Explicitly NOT in v1 (non-goals)
- Accounts, cloud storage, collaboration, payments.
- Porting entire icon sets or batch-animating many icons.
- Figma plugin, Lottie export, Vue/Svelte components (maybe later).
- Full support for filled/outlined icons, masks, gradients, filters, text. (Show a clear "not supported yet" message instead.)
- Changing path structure *after* states exist (v1: structure is locked once state B is created; see §5).

### Later ideas (keep in a backlog, don't build yet)
- Motion budget view: every animated moment in a project grouped by purpose and how often it's seen.
- First-time vs. repeat variants (rich first play, subtle afterwards).
- Lint panel with motion guidance ("hover > 400ms feels laggy", "moves outside safe area at 16px").
- Re-preparing structure with existing states (migrating states).
- Lottie export, Figma plugin, more framework wrappers.

---

## 5. Core rules (non-negotiable)

1. **All states of a prepared icon share an identical structure.** Same elements, same order, same path command sequence, same number of points. States may only change *numbers* (coordinates, transform values, opacity, draw amount). This makes every state interpolable with plain number blending, without any shape-matching algorithm.
2. **Canonical path format.** After preparation, every path uses **absolute** coordinates and only the commands **M, L, C, Z**. Shorthands (H, V, S, Q, T) are expanded; arcs (A) are converted to cubic curves; `<circle>`, `<ellipse>`, `<rect>` (incl. rounded), `<line>`, `<polyline>`, `<polygon>` are converted to paths. Group and element transforms are flattened into coordinates.
3. **Originals are never modified.** Preparation always creates a clone.
4. **Structure is decided in the Prepare step.** Adding or removing points, splitting or joining paths happens *before* state B exists. Once states exist, the structure is locked in v1.
5. **No backend.** Everything runs in the browser. No uploading user assets anywhere.
6. **Security:** user SVGs are sanitized on import: strip `<script>`, `<foreignObject>`, event handler attributes (`on*`), external references (`href` to remote URLs), and anything outside an allowlist of elements and attributes.
7. **Exports must be readable.** Generated code should look like something a careful developer would write: formatted, named, commented where useful. No minified blobs.
8. **Reduced motion is always handled** in every export format.

---

## 6. Concepts and vocabulary

| Term | Meaning |
|---|---|
| **Library** | The user's raw icons, displayed as-is. |
| **Source icon** | One raw SVG from the library (or the starter set). |
| **Prepared icon** | A normalized clone of a source icon, following rules 1–2. The base for animation. |
| **Element** | One drawable part of a prepared icon (always a `<path>` after preparation). |
| **State** | A full set of animatable values for every element (A, B, C…). State A = the prepared icon as-is. |
| **Transition** | Movement from one state to another: duration, easing, per-element delays. |
| **Sequence** | An ordered list of states/transitions (e.g. A→B→A), produced by a pattern template or built manually. |
| **Trigger** | What starts the sequence: hover, click, toggle, loop, appear, manual. |
| **Purpose** | Why this motion exists: feedback, state change, attention, discoverability, delight. Sets defaults. |
| **Motion tokens** | Named durations and easings (e.g. `fast`, `base`, `slow`, `standard`, `snappy`, `spring-gentle`) shared across a project. |
| **Animation** | A prepared icon + its states + sequence + trigger + purpose + reduced-motion choice. The unit the user designs and exports. |

---

## 7. Data model (first draft, TypeScript)

This is the heart of the app. Every feature (editor, preview, export, share link) reads and writes this. Get it right first and keep it versioned.

```ts
// Versioned so saved projects and share links can be migrated later.
export const SCHEMA_VERSION = 1;

export type Purpose = 'feedback' | 'state-change' | 'attention' | 'discoverability' | 'delight';
export type TriggerType = 'hover' | 'click' | 'toggle' | 'loop' | 'appear' | 'manual';

/** Canonical path: absolute coords, only M/L/C/Z. Stored as structured data, not a string. */
export type Segment =
  | { cmd: 'M'; x: number; y: number }
  | { cmd: 'L'; x: number; y: number }
  | { cmd: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { cmd: 'Z' };

export interface ElementStyle {
  // Static presentation, shared across states in v1
  stroke: string;          // usually 'currentColor'
  strokeWidth: number;
  strokeLinecap: 'butt' | 'round' | 'square';
  strokeLinejoin: 'miter' | 'round' | 'bevel';
  fill: string;            // usually 'none' for stroke icons
}

export interface PreparedElement {
  id: string;              // stable id, e.g. 'el-1'
  name?: string;           // optional human label, e.g. 'clapper'
  style: ElementStyle;
}

/** Animatable values for one element in one state. Segment structure must match state A exactly. */
export interface ElementState {
  segments: Segment[];
  transform: {
    translateX: number; translateY: number;
    rotate: number;          // degrees
    scale: number;           // uniform in v1
    originX: number; originY: number; // pivot, in viewBox coords
  };
  opacity: number;           // 0..1
  draw: { start: number; end: number }; // 0..1 fraction of path drawn (pathLength)
}

export interface State {
  id: string;                // 'A', 'B', 'C'…
  label?: string;            // e.g. 'Checked'
  elements: Record<string /* element id */, ElementState>;
}

export type Easing =
  | { type: 'token'; name: string }                       // refers to a motion token
  | { type: 'cubic-bezier'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'spring'; stiffness: number; damping: number; mass: number };

export interface Transition {
  from: string;              // state id
  to: string;                // state id
  duration: number | { token: string }; // ms (ignored for springs, which settle on their own)
  easing: Easing;
  delays?: Record<string /* element id */, number>; // ms offset per element
  stagger?: number;          // ms between elements, applied in element order
}

export interface Sequence {
  steps: Transition[];       // e.g. A→B, B→A
  repeat: 'once' | 'loop' | 'ping-pong';
  restBetweenLoops?: number; // ms pause between loops
}

export interface Trigger {
  type: TriggerType;
  // toggle: two stable states, each click/activation moves to the other
  // hover: forward sequence on enter, reverse (or a defined return) on leave
}

export interface ReducedMotion {
  mode: 'instant' | 'fade' | 'none'; // 'none' = stay on state A
}

export interface Animation {
  id: string;
  name: string;              // e.g. 'Copy → Check'
  purpose: Purpose;
  viewBox: [number, number, number, number]; // usually [0, 0, 24, 24]
  elements: PreparedElement[];
  states: State[];           // states[0] is always A
  sequence: Sequence;
  trigger: Trigger;
  reducedMotion: ReducedMotion;
}

export interface Project {
  schemaVersion: number;
  name: string;
  motionTokens: {
    durations: Record<string, number>;   // { fast: 150, base: 250, slow: 400 }
    easings: Record<string, Easing>;     // { standard: …, snappy: …, 'spring-gentle': … }
  };
  library: { id: string; fileName: string; svg: string }[]; // raw source icons, as imported
  animations: Animation[];
}
```

Notes:
- Paths are stored as **structured segments**, not strings, so the editor, interpolation and validation work on data directly. Serialize to `d` strings only for rendering/export.
- Add a `validateAnimation()` function early that enforces rule 1 (identical structure across states). Run it on load, after every edit in development, and in tests.
- Share links: serialize `Animation` (not the whole project) → compact JSON → compress (e.g. `CompressionStream` deflate or a small lib like `lz-string`) → base64url in the URL hash (`#a=…`), so it's never sent to a server.

---

## 8. The Prepare pipeline (source SVG → prepared icon)

Runs entirely in the browser. Input: raw SVG string. Output: `PreparedElement[]` + state A + a **cleanup report**.

1. **Parse** with `DOMParser` (`image/svg+xml`). Reject on parse errors with a clear message.
2. **Sanitize** (rule 6): allowlist elements (`svg, g, path, circle, ellipse, rect, line, polyline, polygon, title, desc`) and presentation attributes. Drop everything else and record it in the report.
3. **Read the viewBox** (fall back to width/height). Keep the coordinate system; don't rescale.
4. **Resolve styles:** inherited presentation attributes from `<svg>`/`<g>` (Lucide sets stroke, width, caps and joins on the root) → explicit per-element `ElementStyle`. Inline `style=""` attributes are parsed too.
5. **Convert shapes to paths:** circle, ellipse, rect (incl. rx/ry), line, polyline, polygon.
6. **Flatten transforms:** apply group/element `transform` matrices to coordinates; remove groups.
7. **Normalize paths:** absolute coords; expand H/V/S/Q/T into L/C; convert A into C (arcs → cubics); split multi-subpath `d` strings only if the user asks (keep them as one element by default).
8. **Round** coordinates to 3 decimals.
9. **Build state A** with identity transforms (origin = element bounding-box center by default), opacity 1, draw {0, 1}.
10. **Produce the cleanup report**: list of conversions (e.g. "2 circles → paths, 3 arcs → curves, 1 group transform flattened, removed 1 `<script>`").
11. **Visual check:** render the original and the prepared version on top of each other; show a difference overlay so the designer can confirm they match.

**Prepare-step editing tools** (structure changes, only allowed before state B exists):
- Add a point on a segment (split a curve/line at a chosen position).
- Remove a point.
- Simplify (optional, later).
- Split a path at a subpath into separate elements / join elements.
- Name elements (e.g. "clapper").

Library suggestion: [`svgpath`](https://github.com/fontello/svgpath) handles abs/unshort/unarc/transform conversions well and is small; verify it fits before adopting. Otherwise write focused utilities with tests. Keep all geometry in a pure, framework-free `core` package.

---

## 9. The editor (UX)

Layout (desktop first; mobile can be view-only for v1):
- **Left:** library + starter examples + animations in this project.
- **Center:** canvas. Grid matching the viewBox (24×24 by default), zoom, pan. Selected state shown with **onion skin** of the previous state.
- **Right:** inspector for the current selection (element transform/pivot, opacity, draw; transition settings; purpose; trigger; reduced motion).
- **Bottom:** state strip (A, B, C… with "+ clone state") and a **timeline** with scrubbing, play/pause, loop toggle.
- **Preview panel:** the animation live at 16 / 24 / 48px, stroke width options, light/dark background, and a "try the trigger" area (hover/click it like a real UI).

Editing interactions:
- Select element / node / control handle; drag; arrow keys nudge (Shift = larger step); snapping to grid and to other nodes (toggle).
- Multi-select nodes; move together.
- Pivot point drag handle for rotation/scale.
- Undo/redo for everything (command history over the data model).
- Keyboard shortcuts with a small cheat sheet.

Feel matters more than feature count. The owner will judge precision, responsiveness and visual polish by hand. Expect iteration.

**Purpose-first creation:** when creating an animation, the user picks a purpose. Defaults per purpose (initial suggestion, tune later):

| Purpose | Default trigger | Default timing | Default pattern | Reduced motion |
|---|---|---|---|---|
| Feedback | click / manual | `base` | A→B (hold) or A→B→A | instant |
| State change | toggle | `base`, `standard` easing | A↔B | instant |
| Attention | manual / appear | `slow`, spring | A→B→A ×2, rest | none |
| Discoverability | hover | `fast` | A→B→A | none |
| Delight | click | spring | A→B→C→A | fade |

---

## 10. Runtime (the small library that plays animations)

A tiny, dependency-free TypeScript runtime, published later as `icontween` on npm (name currently free).

- Input: an `Animation` (JSON) and a target `<svg>` element.
- Interpolates segments, transforms, opacity and draw per frame with `requestAnimationFrame`.
- Supports cubic-bezier easing and **springs**.
- **Interruptible:** a new trigger starts from the *current* values, not from a state (hover in/out mid-animation must look smooth).
- Handles triggers: hover, click, toggle (exposes `toggle()`, `setState(id)`), loop with rest, appear (`IntersectionObserver`), manual (`play()`, `reverse()`, `stop()`).
- Respects `prefers-reduced-motion` using the animation's reduced-motion setting.
- Target size: **a few KB minified + gzipped**. Track it.

The editor's preview **must use the same runtime** so the preview and the export behave identically.

---

## 11. Export formats

1. **Standalone SVG (no JS):** SMIL `<animate>` / `<animateTransform>` for loop/appear/simple cases. Works as `<img src>`. Mark clearly which triggers aren't possible in this format.
2. **SVG + runtime:** inline SVG with `data-` attributes or an embedded JSON block + a `<script>` tag/import for the runtime. The main format for interactive icons.
3. **React component:** a typed component wrapping the runtime: `<CopyCheckIcon size={24} trigger="click" />`, with an imperative ref for `play()`/`toggle()`.
4. **Animation JSON:** the raw data for developers who want to drive it themselves.

Each export view shows: file size, which triggers work, and a copy button. All code formatted and readable (rule 7).

**Browser note to verify early:** animating the `d` attribute via **CSS** has had gaps in Safari. Don't rely on CSS `d` animation. The runtime (JS) and SMIL are the dependable paths for morphs. Test exports in Safari, Chrome and Firefox at each milestone.

---

## 12. Starter set (10–12 examples)

Chosen to show the range of *purposes*, not just to look nice. Source shapes from **Lucide** (ISC; keep the license notice in the repo). Each one is a hand-crafted example that ships pre-animated and can be opened in the editor to learn from.

- **State change:** play ↔ pause, menu ↔ close, lock ↔ unlock, eye ↔ eye-off, volume ↔ volume-x
- **Feedback:** copy → check, send, download
- **Attention:** bell
- **Delight:** heart
- **Discoverability:** search (or chevron "peek")
- **Loading:** refresh-cw

Note: icon-to-icon pairs (e.g. play → pause) have different structures. They're made by preparing one icon, adding points in the Prepare step, then shaping state B to look like the other icon. This is a good stress test for the tools and a good showcase.

---

## 13. Tech stack (recommended)

- **Vite + TypeScript + React** (React for familiarity and hireability). State: **Zustand** (simple, works well with undo history).
- **Monorepo** with pnpm workspaces:
  ```
  icontween/
  ├─ apps/
  │  └─ web/            # editor + landing page (Vite/React)
  ├─ packages/
  │  ├─ core/           # data model, schema, validation, geometry, prepare pipeline (pure TS, no DOM rendering deps)
  │  ├─ runtime/        # tiny playback library (no deps) → npm "icontween"
  │  └─ react/          # React wrapper around runtime
  ├─ examples/          # starter set as .icontween.json + source SVGs
  ├─ docs/
  │  ├─ decisions/      # short ADR-style notes, one per decision
  │  └─ devlog.md       # dated progress notes (feeds the case study)
  ├─ CLAUDE.md
  ├─ PROJECT_BRIEF.md
  ├─ LICENSE            # MIT
  └─ THIRD_PARTY_LICENSES.md  # Lucide ISC
  ```
- **Testing:** Vitest for `core` and `runtime` (geometry, prepare pipeline, validation, interpolation). A fixtures folder of tricky SVGs (arcs, transforms, rounded rects, nested groups, inline styles, malicious content). Playwright later for a few end-to-end smoke tests.
- **Linting/formatting:** ESLint + Prettier.
- **Hosting:** Cloudflare (static site from the GitHub repo, preview deployments per branch). Domain: icontween.com.
- **CI:** GitHub Actions: typecheck, lint, test, build on every push.

---

## 14. Milestones

Each milestone ends deployable, with a devlog entry.

### M0: Foundations (a weekend)
- Monorepo, tooling, CI, Cloudflare deploy of a placeholder page.
- `core`: data model types, `SCHEMA_VERSION`, `validateAnimation()`, segment ↔ `d` serialization, tests.
- **Done when:** `pnpm test` passes in CI and the placeholder is live.

### M1: Prepare pipeline (1–2 weekends)
- Parse, sanitize, styles, shapes → paths, flatten transforms, normalize to M/L/C/Z, arcs → cubics, report.
- Fixtures + tests for each conversion.
- Minimal UI: paste/upload an SVG → see original vs prepared overlay + report.
- **Done when:** all 12 starter Lucide icons and the fixture set prepare with visually identical results.

### M2: Core proof: states and morph (1–2 weekends)
- Clone A → B; select and drag nodes and handles on the canvas; onion skin.
- Runtime v0: interpolate segments between two states with cubic-bezier easing; play/reverse; interruptible.
- **Done when:** the owner can recreate a "filter" style morph (sliders swapping sides) from scratch and it plays smoothly on hover.

### M3: Full animation model (2–3 weekends)
- Transforms with pivot, opacity, draw; multiple states; sequences and pattern templates; springs; per-element delay/stagger.
- Triggers: hover, click, toggle, loop with rest, appear, manual.
- Purpose picker with defaults; motion tokens; reduced-motion setting.
- Preview panel (16/24/48px, stroke widths, light/dark).
- Undo/redo.
- **Done when:** all 12 starter examples can be built in the editor.

### M4: Persistence, export, sharing (1–2 weekends)
- IndexedDB auto-save; `.icontween.json` import/export; share links in the URL hash.
- Exports: SVG (SMIL), SVG + runtime, React component, JSON; size indicator.
- Cross-browser check of exports (Safari, Chrome, Firefox).
- **Done when:** an exported React component and SVG+runtime file work in a fresh Vite app and a plain HTML page.

### M5: Showcase and launch (1–2 weekends)
- Landing page: philosophy in a few lines, the starter examples live, "Open in editor" on each.
- README with GIFs, live link, quick start, architecture overview.
- Library flow polish (multi-file drop, thumbnails), error messages for unsupported SVG features.
- Accessibility pass on the app UI (keyboard, focus, contrast).
- **Done when:** icontween.com is live and the owner is happy to post it.

---

## 15. Working agreement for Claude Code

- **Small steps.** One feature or fix per session/PR. Test by hand, commit, move on. Don't build several features at once.
- **Data model first.** Changes to the schema are deliberate: bump `SCHEMA_VERSION` and add a migration when the saved format changes.
- **Pure core.** Geometry and pipeline code lives in `packages/core`, is framework-free and covered by tests.
- **Preview = export.** The editor uses the same runtime that ships in exports.
- **Ask before** adding a dependency larger than a few KB, changing the schema, or changing rules in §5.
- **Log decisions.** For any meaningful choice, add a short note in `docs/decisions/NNN-title.md` (context, decision, alternatives). Add a dated line to `docs/devlog.md` at the end of each session. These feed the portfolio case study.
- **The owner judges feel.** Claude can't see the animation running, so for anything visual, describe what to check and expect feedback like "snappier", "the handle jumps". Iterate.
- **Readable output.** Generated/exported code is formatted and named for humans.

---

## 16. Brand notes

- Name: **IconTween** in running text. Logo: lowercase two-tone wordmark (`icon` regular + `tween` bold/accent) to avoid the capital-I/lowercase-l ambiguity. The logo itself can animate ("tween" morphing in from "icon").
- Tagline: *Motion for the moments that matter.*
- Tone: calm, precise, opinionated but friendly. The product should feel like a craft tool, not a toy.

---

## 17. Open questions (decide along the way)

- Exact motion token values and spring presets.
- Whether hover "leave" plays the sequence in reverse or a separately defined return transition.
- Share link size limits for complex animations (measure; fall back to file export if too long).
- How much of the Prepare-step structure editing (split/join/simplify) is needed for the starter set vs. later.
- Whether to support filled/outlined icons in a limited way in v1.
