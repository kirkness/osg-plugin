---
name: osg-sdk
description: Use when writing or changing game code that touches the Our Silly Games SDK (@osg/sdk): ready, player, saves, leaderboards, achievements, stats, rooms, chat, NPC decisions, analytics, feature detection. Code touches only osg, never fetch or WebSocket.
allowed-tools: mcp__plugin_osg_osg-docs__read_doc mcp__plugin_osg_osg-docs__search_docs mcp__plugin_osg_osg-docs__validate_manifest
---

# Using the SDK

Read the `sdk` doc first (`read_doc`, slug `sdk`) and the `manifest` doc (slug `manifest`). Then follow these rules.

## Where the SDK comes from

No npm account, scope or registry is involved. `@osg/sdk` is a tarball served from our own domain, and the project's `package.json` points at it by URL (`"@osg/sdk": "https://oursilly.games/sdk/osg-sdk-<version>.tgz"`); the lockfile pins its integrity hash. `bun install` fetches it; commit the lockfile. Update with `bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" update-sdk`. Never hand-edit the URL to anything else (another host, a git, file or `link:` source): the server build refuses it. The tarball provides the import, the types and the dev-time pieces only; the real runtime is served by the platform inside the game, so an older SDK copy keeps working. Read the `sdk` doc for offline use.

## Rules

1. `import { osg } from "@osg/sdk"`. The platform injects the runtime when hosted; elsewhere you get a standalone adapter. One build runs in `hosted`, `dev` and `standalone`.
2. **Never** use `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon` or `RTCPeerConnection`. The game runs in a sandbox with no network, and the review rejects such code. Saves, scores and multiplayer all go through `osg`.
3. **Declare everything in `osg.json`** (boards, achievements, stats, rooms, chat phrases, NPC brains, analytics events). Undeclared features are refused. Validate with the `validate_manifest` tool or `osg validate`.
4. Start with `await osg.ready()`, call `osg.lifecycle.loaded()` at the first interactive frame, honour `onPause`/`onResume`, and flush saves in `onSuspend`.
5. Gate optional features with `osg.can("rooms")`, never try/catch for "multiplayer unavailable". The single-player game must work with every platform feature off.
6. Every SDK call can reject (`OsgError` with `code`, `retryable`). Game code must survive it and keep playing.
7. Never save, send or display secrets, tokens or other players' text. Never render other players' names yourself; use `osg.leaderboards.show()`.
8. Use `createRng`, `fixedStep` and `createInterpolator` from `@osg/sdk` for deterministic simulation and smooth remote entities.

## Before writing multiplayer code, ask

Which topology: `host-authoritative` (default), `peer-authoritative`, `lockstep` or `turn-based`? How many players (2-8, NPCs included)? What is the worst latency the game tolerates? Then follow `osg-multiplayer`. Do not write netcode until the author has answered.

## Pointers

Boards and bounds: `osg-scores`. NPC decisions: `osg-npcs`. Running it: `osg-dev`. Use the `search_docs` tool for anything not covered.

## Testing

`createMockOsg({ peers, seed })` from `@osg/sdk/mock` gives a deterministic fake for unit tests with no network. Pure game logic should live in plain functions that take a state and inputs, so it can be tested with `bun test`.
