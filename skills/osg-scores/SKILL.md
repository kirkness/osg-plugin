---
name: osg-scores
description: Use when adding leaderboards, scores, high scores, achievements or stats: declaring bounded boards (min, max, maxPerSecond), the start/submit run flow, why client-trusted scores fail, guest lanes, global-rank fairness, achievement and stat design.
allowed-tools: mcp__plugin_osg_osg-docs__read_doc mcp__plugin_osg_osg-docs__get_playbook mcp__plugin_osg_osg-docs__validate_manifest
---

# Scores, boards, achievements

Read the `scores` doc (`read_doc`, slug `scores`) and follow the `add-leaderboard` playbook (`get_playbook`, name `add-leaderboard`).

## The core truth

Game code runs on the player's machine, so **any client score can be faked**. The platform's defence is bounds. Without them a board fills with impossible numbers.

## Rules

1. Only add a board if the game has a **bounded, replayable round** (30 s to 5 min) that ends in one number.
2. Declare every ranked board as `kind: "bounded"` with `min`, `max`, `maxPerSecond` (all required) and ideally `minDurationMs`. Derive them from the game's rules and show the author the arithmetic. `unbounded` boards are labelled "reported" and **never count toward the global ranking**.
3. Flow: `osg.leaderboards.start(id)` at round start, `submit(run, value, { durationMs })` once at round end. Compute the value from game state; never from user input or storage.
4. Handle rejection (`rate_limited`, `invalid_argument`, `sign_in_required`) without breaking play; offer sign-in from a user click via `osg.player.requestSignIn()`.
5. Set `show.top` (default 10, max 100) and `show.around` (max 5). Display with `osg.leaderboards.show(id)`; do not draw other players' names yourself.
6. Scores from multiplayer rooms (and any room with NPCs) are **unranked**. Keep a single-player board for ranked play.
7. Guests have their own lane, never in daily/weekly periods and never global.
8. Achievements and stats are declared in `osg.json` (ids cannot be invented). Prefer stat-bound achievements the server unlocks (`stat` + `target`), reachable in a few sessions; a few hidden ones; teach features. Stats batch with `osg.stats.inc` and `osg.stats.max`.
9. Do not design around gaming the global ranking; the formula is versioned and may change. Eligibility numbers are in the `limits` doc.

Validate with the `validate_manifest` tool or `osg validate`.
