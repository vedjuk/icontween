# 024 — Phones get a viewer, not the editor

Date: 2026-11-11

## Context

The editor is a three-column workbench (library, canvas, inspector) with a fixed grid and no
small-screen layout. On a 375px phone it scrolled sideways and cut the canvas off. Phones
reach it mostly through the landing page's starter links and through share links, so the
people most likely to land there (someone tapping a link in a case study or a chat) got the
broken view. The brief already allowed it: "desktop first; mobile can be view-only for v1".

Moving points and curve handles by finger on a small screen is a design project of its own,
and it's not what anyone opening a link on a phone is trying to do.

## Decision

**Below 48rem (`(max-width: 47.99rem)`, where the landing page stacks), `/editor` and
`/prepare` show the phone viewer (`apps/web/src/phone/PhoneView.tsx`) instead.** It switches
live, so turning a tablet or resizing a window moves between the two. Above it, the editor
is unchanged.

The viewer shows one animation:

- Large (9rem) and at 48 / 24 / 16 px in one tile, played by `createPlayer`, the runtime that
  ships (rule 9). The tile is the control, as on the landing page.
- A Motion switch (System / Reduced / Full), so the reduced-motion design can be seen.
- Read-only decisions: purpose and its hint, trigger, sequence and pattern, timing per step,
  reduced motion, and how many paths and states it's made of. The words come from
  `editor/labels.ts`, shared with the inspector.
- "Editing needs a bigger screen", with **Copy link** (and the system share sheet where there
  is one). The link opens the same animation in the editor on a laptop.
- Your own animations from this browser, then the starters, to switch between.

What it opens: a share link in the hash, else an icon id (`#lucide-bell`: your animation for
it, else the starter), else the icon last open. Picking one pushes `#id`, so Back works.

**The viewer only looks.** A share link is decoded with the same checks as in the editor,
but nothing joins the saved project, and the "replace your animation?" and "use the link's
timing?" questions never come up. They belong where the animation can be edited. Link tokens
are laid over the default tokens, not the project's, so it plays as it was shared.

**Hover on touch plays as a toggle.** A tap fires the pointer's enter and leave together, so
a hover animation played and reversed at once or barely moved. Where the device can't hover
(`(hover: none)`), the viewer passes `trigger: 'toggle'` to the runtime: one tap plays it,
the next plays it back. The hint and the Trigger fact say so. It's the same runtime and the
same data; only the event that starts it differs.

**Landing:** on phones the starter cards' "Edit" link reads "View", since that's what opens.

## Not in this pass

- **Exported hover icons on phones** have the same enter-and-leave-at-once problem. Fixing it
  changes what exports do, so it needs its own decision and an export-check run.
- **Tablets** (48rem and up) get the full editor. Most of it works with a trackpad or mouse.
- Editing on a phone.

## Alternatives

- **A responsive editor** (stacked panels, larger handles): the most complete, but a large
  design job for a use nobody has asked for.
- **A "use a bigger screen" wall:** honest and tiny, but it wastes the visit. Most phone
  visitors came to see an animation, and the viewer shows it.
- **Saving shared links on phones too:** consistent with the editor, but it adds to a project
  you can't edit there and asks questions you can't act on.
