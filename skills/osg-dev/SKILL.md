---
name: osg-dev
description: Use to run, test, check or screenshot the game locally with the bundled osg command: osg dev (emulated shell, rooms, boards, chat, NPCs, simulated players, chaos), osg check, osg shot, osg validate, osg build, resetting local state.
allowed-tools: Bash(bun --version) mcp__plugin_osg_osg-docs__read_doc
---

# Local development

Read the `dev` doc (`read_doc`, slug `dev`) for the full flag list, and run `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" --help` for the flags of the installed version. Always run the bundled CLI, never a floating package. It needs Bun 1.3 or newer (`bun --version`).

## Commands (always `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" <command>`)

| Command | Use |
| --- | --- |
| `dev` | start the local platform at http://localhost:4777: the real shell code, sandbox headers, rooms relay, boards, saves, achievements, chat, fake NPC provider. Every browser tab is a different player. |
| `dev --peers 3` | three simulated extra players, so one person can test a four-player room |
| `dev --npcs 2` | fill seats with NPCs |
| `dev --chaos latency=80-200,drop=2%` | bad network: always test multiplayer with this on |
| `dev --strict` | production limits |
| `dev --host-style=path` | Safari, when `*.localhost` does not resolve |
| `check [--players N]` | validate, scan, build, then play headless (N pages in a room). Same finding codes and fix hints as the server |
| `shot` | screenshots at 1280x720 for self-critique |
| `update-sdk` | move the project to the latest `@osg/sdk` tarball from oursilly.games/sdk and refresh the lockfile. Run it, then `check`. `OSG_SDK_BASE` overrides the base URL for local or staging use. |
| `validate`, `build`, `pack` | manifest and archive rules, the pinned build, the source archive |

`dev` is a long-running server: start it in the background and tell the author the URL. Do not start a second one on the same port.

## Offline

`dev`, `check` and `shot` need only what is already installed: keep `node_modules/` and the lockfile. A fresh clone with no network cannot fetch the SDK tarball, so `bun install` fails until oursilly.games/sdk is reachable again (Bun may reuse its own cache if it has the same tarball). Do not work around that with another SDK source. The platform serves the runtime in the real game, so an SDK copy that is a little old still works.

## Habits

- Test inside `osg dev`, not by opening the file directly (that is `standalone` mode only).
- Run `check` before every submit; fix every finding; the server is still the source of truth.
- Reset local state by deleting the `.osg/` folder (never submitted, never committed).
- If something fails, look in `troubleshooting` (`read_doc`, slug `troubleshooting`) before guessing.
- Never run `osg dev --lan` unless the author asks to test on a phone; it exposes the dev server to the local network.
- `--npc-live` uses the author's own key from their environment; never ask for or print the key, never put it in the game.
