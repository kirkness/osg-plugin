---
name: osg-design
description: Run BEFORE writing game code, and again for polish. Aesthetics and ideation for a distinctive, high-quality browser game: hook, friend test, core loop, visual direction with banned generic defaults, juice, screenshot moment, self-critique with osg shot, scoring rubric.
allowed-tools: mcp__plugin_osg_osg-docs__read_doc mcp__plugin_osg_osg-docs__get_playbook
---

# Design before code

The goal is a game a stranger plays twice and sends to a friend. Generic ideas in generic skins fail. Do not start coding until the brief below exists in writing (`DESIGN.md`) and the author has agreed to it. Ask questions only where the answer changes the design; otherwise propose and let them react. Offer 2-3 distinct directions when the idea is open.

For the full guide, read the `design` doc (`read_doc`, slug `design`). The polish checklist is the `polish-pass` playbook.

## The brief

1. **Hook in one sentence.** "You are a ___ who must ___ before ___." Two sentences means two games.
2. **Friend test.** Why would a stranger send this to a friend? One concrete reason.
3. **Three feel references.** Name three games or toys for the *feel* (movement, scoring pop, pacing). They are for feel only: never copy a name, character, art, sound or layout (see `osg-rules`).
4. **30-second core loop.** Second by second: input, feedback, reward. Fun before levels, menus and story.
5. **Failure state.** What happens on loss; why it is funny or fair; restart in under two seconds.
6. **One more go.** What pulls the next attempt.
7. **Screenshot moment.** The single frame that makes someone tap the card. Design it.

## Visual direction, chosen on purpose

Decide and write down: a palette of 4-6 named colours with roles and checked contrast; one or two **vendored** fonts and why; shape language; motion style; the 6-10 sounds and what each feels like; the juice list.

**Banned defaults:** the browser default font; flat grey UI and white cards on grey; **purple or pink gradients**; stock emoji as art; a gradient banner with a centred "Start" button as the whole menu; copying a famous game's look. If the draft contains one of these, replace it and say what you chose instead.

## Build order

1. A playable first slice fast (one input, one loop, one score). Ugly is fine.
2. Then **feel**, not features: easing, screen shake with decay, hit-stop, squash and stretch, particles, score pops, sound (procedural Web Audio needs no files), instant restart.
3. Then the skin: palette, type, art, menu, game over.
4. Then platform features (`osg-sdk`).

Ultracode pays off for the first build and the polish pass (`/effort ultracode`, off again with `/effort ultracode off`). You cannot enable it yourself.

If the author's Claude has a `frontend-design` skill you may use it for UI craft, but nothing here depends on it.

## Self-critique

After each pass run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" shot` and look at the frames as a stranger: clear in 3 seconds? screenshot moment present? anything that looks like a default? any dead frame? would I restart?

## Rubric (0-3 each, restart a pass under 18 of 24)

Hook, core loop, feel, visual identity, sound, clarity, restart, screenshot. Score honestly and show the author the scores with one line of evidence each.

## Always

Respect `prefers-reduced-motion` and never flash more than three times a second. Touch targets at least 44 px if touch is declared. Everything vendored; nothing remote.
