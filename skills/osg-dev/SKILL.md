---
name: osg-dev
description: Use to run, play, stop, restart, test, check or screenshot the game locally with the bundled osg command ("run my game", "let me play it", "stop the game", "close it", "restart it"): osg dev (emulated shell, rooms, boards, chat, NPCs, simulated players, chaos), osg stop, osg check, osg shot, osg validate, osg build, resetting local state.
allowed-tools: Bash(bun --version) Bash(bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" dev) Bash(bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" dev --reset) Bash(bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" stop) Bash(bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" status --dev) mcp__plugin_osg_osg-docs__read_doc
---

# Local development

Read the `dev` doc (`read_doc`, slug `dev`) for the full flag list, and run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" --help` for the flags of the installed version. Always run the bundled CLI, never a floating package. It needs Bun 1.3 or newer (`bun --version`).

## Commands (always `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" <command>`)

| Command | Use |
| --- | --- |
| `dev` | start the local platform at http://localhost:4777: the real shell code, sandbox headers, rooms relay, boards, saves, achievements, chat, fake NPC provider. Every browser tab is a different player. Long-running: see "Running the game for the author". |
| `stop` | stop this project's `dev` server (graceful, then forced) |
| `status --dev` | whether this project's game is running locally, and its link |
| `dev --peers 3` | three simulated extra players, so one person can test a four-player room |
| `dev --npcs 2` | fill seats with NPCs |
| `dev --chaos latency=80-200,drop=2%` | bad network: always test multiplayer with this on |
| `dev --strict` | production limits |
| `dev --host-style=path` | Safari, when `*.localhost` does not resolve |
| `check [--players N]` | validate, scan, build, then play headless (N pages in a room). Same finding codes and fix hints as the server |
| `shot` | screenshots at 1280x720 for self-critique |
| `update-sdk` | move the project to the latest `@osg/sdk` tarball from oursilly.games/sdk and refresh the lockfile. Run it, then `check`. `OSG_SDK_BASE` overrides the base URL for local or staging use. |
| `validate`, `build`, `pack` | manifest and archive rules, the pinned build, the source archive |

## Running the game for the author

The author is usually not technical. You run the game for them and you stop it for them. They never need a terminal.

- **Start (or "let me play it", "open the game"):** from the project folder, run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" dev` with the Bash tool **in the background** (`run_in_background: true`). Wait until its output has the line `<Game name> is running: <link>` (a build may come first; that can take a minute), then tell the author one sentence: that the game is running and the link to open, e.g. "Seed Dash is running: open http://localhost:4777 in Chrome." If it prints `is already running`, the game was already up: give the same sentence. Nothing else.
- **Stop ("stop the game", "close it", "end it", "I'm done"):** run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" stop` and say "Stopped." (it prints `Stopped <name>.` or `No game is running.`; both mean it is stopped).
- **Restart ("restart it", it looks stuck, you changed the build setup or `osg.json`):** run `stop`, then start it again as above and give the link again. A code change in a static game needs only a browser refresh; a vite or bun game is rebuilt when it starts, so restart it after code changes and tell the author to refresh.
- **Is it running? / what was the link?:** run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" status --dev` and pass on the link.
- If it fails, read the error yourself, fix what you can (a build error is yours to fix), and tell the author in plain words what happened. If another game is using the address, stop that one first (run `stop` in its folder) and start this one again.
- When the Claude session ends the game may stop with it. That is fine: start it again next time.
- `check` and `shot` run their own private copy of the game, so a running game can stay open while you use them.

**Never** tell the author to run `kill`, `pkill`, `lsof`, `ps` or `Ctrl+C`, and never mention process ids, the `.osg/dev.json` file, background tasks or shell commands. If the output ever includes a "Stop it any time with: osg stop" line, do not repeat it; that is for people in their own terminal. Only show a port when it is part of the link. Do not start a second `dev` for the same project; `dev` refuses and prints the running link anyway.

## Offline

`dev`, `check` and `shot` need only what is already installed: keep `node_modules/` and the lockfile. A fresh clone with no network cannot fetch the SDK tarball, so `bun install` fails until oursilly.games/sdk is reachable again (Bun may reuse its own cache if it has the same tarball). Do not work around that with another SDK source. The platform serves the runtime in the real game, so an SDK copy that is a little old still works.

## Habits

- Test inside `osg dev`, not by opening the file directly (that is `standalone` mode only).
- Run `check` before every submit; fix every finding; the server is still the source of truth.
- Reset local state: stop the game, then start it in the background with `dev --reset` (same steps as Start) (or delete the `.osg/` folder while it is stopped). It is never submitted, never committed.
- If something fails, look in `troubleshooting` (`read_doc`, slug `troubleshooting`) before guessing.
- Never run `osg dev --lan` unless the author asks to test on a phone; it exposes the dev server to the local network.
- `--npc-live` uses the author's own key from their environment; never ask for or print the key, never put it in the game.
