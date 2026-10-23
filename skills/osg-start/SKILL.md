---
name: osg-start
description: Start here when the author wants to make, build or publish a browser game for Our Silly Games ("make me a game about...", "I want to create a game", "new game"). Runs the Bun preflight, forces a creative brief before code, scaffolds the project, recommends ultracode and explains the submit-to-email timeline.
allowed-tools: Bash(bun --version) mcp__plugin_osg_osg-docs__read_doc mcp__plugin_osg_osg-docs__get_playbook
---

# Start a game

You are helping an author make a browser game and publish it on Our Silly Games. Work in this order. Do not write game code until step 3 is done.

## 1. Preflight

Run `bun --version`. The `osg` command and local dev server need **Bun 1.3 or newer** (not Node).

- Missing or older: tell the author the one-line install and ask before running it.
  - macOS or Linux: `curl -fsSL https://bun.sh/install | bash`
  - Windows (PowerShell): `powershell -c "irm bun.sh/install.ps1 | iex"`
  - then restart the terminal and re-check.
- Never use `npx -y` or any floating package to run the CLI. Always run the bundled copy: `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" <command>`.
- This plugin works in Claude Code (terminal, and the desktop app's Code tab). It does not work in claude.ai chat, Claude cloud sessions or desktop WSL sessions. If you are in one, say so plainly.

## 2. Recommend ultracode

Say this once, in the author's terms:

> For the best game, turn on ultracode: run `/effort ultracode` (or start Claude with `claude --effort ultracode`). It uses more of your Claude usage, so it is worth it for the first build and the polish pass; afterwards run `/effort ultracode off`.

You cannot switch it on yourself. Do not nag.

## 3. Creative brief first

Follow the `osg-design` skill now, before any code: hook, friend test, 30-second loop, failure state, one more go, screenshot moment, visual direction. Save the result as `DESIGN.md` in the project. If the author already has a clear brief, confirm it against the rubric and move on.

## 4. Scaffold

- Empty folder: run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" init`, then `bun install` (this fetches the SDK tarball from oursilly.games/sdk, no npm account or scope needed, and creates the lockfile with its integrity hash that the server build requires; keep it committed). If `bun install` cannot reach oursilly.games, say so plainly and retry later; do not swap in another source for `@osg/sdk`. Then restyle and rewrite the starter to match the brief; the starter is a placeholder, not a design.
- Existing project: read `osg.json` and `CLAUDE.md` and continue.
- Read the `getting-started` doc (`read_doc` with slug `getting-started`) if you need the details.

## 5. Build, then check

- Running the game: you start it for the author exactly as the `osg-dev` skill says (in the background, then one sentence with the link to open), and you stop or restart it when they ask. Never give them shell commands, process ids or `kill`/`pkill`/`Ctrl+C` instructions; they should never need a terminal.
- SDK usage: `osg-sdk`. Local running and testing: `osg-dev`. Multiplayer, NPCs, scores: `osg-multiplayer`, `osg-npcs`, `osg-scores`. Art, sound, fonts: `osg-assets`.
- Rules that fail games: `osg-rules`. Keep every font, library and asset inside the project; no CDN, no network calls.
- For a whole first game, `get_playbook` with name `first-game` is the checklist.

## 6. Tell the author the timeline

When they submit (`/osg:osg-publish`, which only they can start), we build the source, run the game in a cloud browser, check the rules, and **publish immediately if it passes**. They get an **email in about 10-20 minutes**, and can close the window. A rejection email says exactly what to fix.

## Never

Ask for or store passwords, tokens or API keys. Put secrets in the game. Submit on the author's behalf without them running `/osg:osg-publish`.
