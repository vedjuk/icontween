# 007 — Springs, repeat, and the loop and appear triggers

Date: 2026-11-09

## Context

M3 part 1 finishes the runtime's playback model: springs, repeating sequences (`loop`,
`ping-pong`, rest between loops) and the last two triggers (`loop`, `appear`). The editor and
playground expose them so they can be judged by hand. Extends decision 005.

## Decision

- **Springs are solved in closed form,** not simulated. A spring released at rest has an
  exact formula for under-, critically and over-damped cases, so it looks the same at 30, 60
  or 120 fps and costs one `exp`/`cos` per element per frame. Parameters use the usual units
  (stiffness, damping, mass in seconds), as in Framer Motion and React Spring.
- **A spring becomes an easing over its own settle time.** The settle time is the last
  millisecond the spring is still 0.1% or more of the distance away from its target (capped at
  5 s for springs that barely damp). The transition's `duration` is ignored, as the schema
  already says. Each parameter set is solved once and cached.
- **Interrupted springs keep their full length.** A spring settles in the same time however
  far it travels, so a reverse halfway through still takes the whole settle time instead of
  being squeezed like a curve. Velocity is not carried across an interruption yet (the new
  leg starts at rest from the current values). Revisit if hover springs feel stiff when
  reversed.
- **Overshoot is clamped only where values have a range:** opacity and draw are clamped to
  0..1 when rendering. Coordinates, rotation and scale overshoot freely.
- **Three spring tokens:** `spring-gentle` (no overshoot, ~0.6 s), `spring-snappy` (small
  overshoot), `spring-bouncy` (visible bounce, for delight). Initial values, to tune by hand.
- **Repeat only goes forwards.** `play()` on a `loop` or `ping-pong` sequence repeats until
  `reverse()` or `stop()`. `reverse()` always returns to the first state and stops, so hover
  "leave" ends a looping hover cleanly.
- **Loop rests on the last state, then jumps to the first.** For cyclic sequences (A→B→A) the
  jump is invisible; for A→B it shows the finished state during the rest (a completed check
  stays visible before redrawing). Ping-pong rests at both ends.
- **The loop trigger implies repetition.** Picking "loop" as the trigger with a `once`
  sequence still repeats; the editor says so.
- **No endless motion with reduced motion.** Under reduced motion a repeating sequence plays
  once (instant or fade) and stops, also when the OS setting changes while it loops. This
  follows the brief ("no endless attention-grabbing motion") and WCAG 2.2.2.
- **Loop and appear use `IntersectionObserver`** on the trigger element (half visible counts).
  `appear` plays once, the first time. `loop` plays while visible and pauses off screen, so a
  page full of looping icons costs nothing when they're scrolled away. Without
  `IntersectionObserver` both simply start.
- **Missed cycles are skipped.** After a long gap (background tab), a looping animation
  starts its next cycle now instead of replaying every cycle it missed. A cycle of zero length
  never repeats, so it can't spin.
- **Size:** 3.89 KB min+gzip (was 3.1 KB). Still "a few KB".

## Alternatives

- Simulating springs per frame (Euler/RK4): frame-rate dependent, and needs velocity state.
- Mapping springs to a fixed duration (like CSS `linear()` spring approximations): loses the
  physical feel of stiffness and mass, and makes the duration field lie.
- Making reduced motion still loop with `fade`: endless fading is still endless motion.
