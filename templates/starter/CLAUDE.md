# Seed Dash: an Our Silly Games project

This folder is a browser game for Our Silly Games (https://oursilly.games), built with the `osg` Claude Code plugin.
The starter game here is a placeholder. **Replace its look, feel and rules** with the author's own idea.

## Do this first

1. If `DESIGN.md` does not exist, run the `osg-design` skill and write it before changing code: hook, core loop, visual direction, screenshot moment.
2. Check `bun --version` (needs 1.3+), then `bun install` once. Commit the lockfile: the server build requires it.
3. Run the game: use the `osg-dev` skill (`osg dev`).
4. Before submitting: `osg-rules` pre-flight checklist, then the author runs `/osg:osg-publish`.

## Hard rules (the review rejects games that break them)

- **No network, no CDN.** No `fetch`, `WebSocket`, analytics, remote fonts, scripts or images. Every font, library and asset lives in this project. Use the SDK for saves, boards, rooms.
- **No copyrighted names, characters, art, sound or music.** Credit licensed assets in `CREDITS.md`.
- **No rude words or imagery**, including in generated text.
- Declare every platform feature in `osg.json`. Keep boards bounded. NPCs must work with the model off (`fallback`).
- Never put secrets, tokens or other players' text in saves, room messages or NPC `world`.
- No purple or pink gradients, no default fonts, no stock emoji art: see `osg-design`.

## Layout

- `osg.json` manifest. `slug` must match the game created on the platform (change `slug` and `name` first).
- `src/game.ts` pure simulation (unit-tested: `bun test`). `src/main.ts` rendering, input and SDK calls.
- `src/board.ts` the leaderboard screen's view model (unit-tested). The game draws its own board from `osg.leaderboards.top()`/`around()` in the game's style; restyle it with the rest of the game. Never use `osg.leaderboards.show()` (deprecated).
- `.claude/settings.json` registers the plugin marketplace for this project.
