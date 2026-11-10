# 013 — Starter recipes: no structure tools needed

Date: 2026-11-10

## Context

M3 is done when all 12 starters (brief §12) can be built in the editor. Six are
icon-to-icon pairs whose two Lucide icons have different structures, and the Prepare-step
structure tools (add/remove points, split/join; brief §8) don't exist yet. Brief §17 asks how
many of them the starter set needs.

## Decision

- **None for v1's starter set.** Each pair can be built from one prepared icon with point
  moves, transforms, opacity and draw. `core/test/starter-builds.test.ts` builds all 12 with
  only the operations the editor's controls call and checks every pair against the Lucide
  icon it turns into (within 0.5 units, i.e. half a pixel at 24 px). The answer to §17 is
  "later, for users' own icons": they stay in the backlog.
- **Prepare the icon with more parts, then shape the other one from it.** If one icon of a
  pair has more elements or points, prepare that one. Edit state A as well as B when
  needed: A is the one that ships first.
  - play ↔ pause: prepare pause. Both rounded rects are reshaped (in A) into play's rounded
    triangle, the same triangle for both, so they merge. The rect's two right corners share
    the tip.
  - eye ↔ eye-off: prepare eye-off. In A the two lid pieces close up into the eye outline
    (meeting at the top and bottom of the lids), the half pupil becomes a full circle from
    two half-circle cubics, and the slash is undrawn (draw end 0).
  - copy → check: the front sheet's closed rounded rect traces the check there and back,
    with zero-length corners. The back sheet fades. A 1 s delay on the return step holds the
    check.
  - menu ↔ x: rotate ±45° and translate the outer lines; the middle line fades. The lines
    stay 16 long against Lucide's 17 (0.49 off at the ends). Scaling to fit would also
    thicken the stroke.
  - lock ↔ lock-open: the shackle's right leg has zero length in B, and its arc ends where
    lock-open's does.
  - volume ↔ volume-x: the two waves become straight cubics (handles on the line).
- **Single-icon starters** use transforms only: bell (rotate around the top, clapper 60 ms
  behind, Return ×2), heart (scale 0.8 then 1.15 on a bouncy spring), search (tilt around the
  lens on hover), send (fly out top right, a 0 ms jump while invisible, fly in from bottom
  left), download (arrow dips 3), refresh-cw (one linear turn, looping).
- **The test recipes are first drafts,** not the shipped examples. Timing and feel are the
  owner's call. The `.icontween.json` files come with import/export (M4).

## Alternatives

- **Build add-point / join tools first.** They would make eye ↔ eye-off match Lucide's
  geometry more literally, but every pair already matches within half a pixel without
  them.
- **Fake missing parts with a second icon on top.** It breaks rule 1 (one prepared icon per
  animation) and preview = export.
