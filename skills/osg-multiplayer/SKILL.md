---
name: osg-multiplayer
description: Use when adding or debugging multiplayer: rooms, lobby and quick play, party codes and invites, host-authoritative vs relay topologies, snapshots and host migration, reconnects and epochs, the 8-seat cap, honest latency limits.
allowed-tools: mcp__plugin_osg_osg-docs__read_doc mcp__plugin_osg_osg-docs__get_playbook
---

# Multiplayer

Read the `multiplayer` doc (`read_doc`, slug `multiplayer`) and follow the `add-multiplayer` playbook (`get_playbook`, name `add-multiplayer`).

## Be honest, in code and in copy

- A room is a **relay** over WebSockets, **not peer-to-peer and not a game server**. It never runs or parses game logic.
- Up to **8 seats, NPCs included**. Latency between regions is roughly 150-300 ms (unmeasured at scale).
- Good for co-op, party, turn-based and forgiving arena games. **Not for competitive twitch play.** Never promise it. The host is trusted. Scores from rooms are unranked.

## Before any netcode, ask the author

1. Topology: `host-authoritative` (default), `peer-authoritative`, `lockstep`, `turn-based`.
2. Min and max players (2-8 total with NPCs).
3. Latency tolerance, and what happens when the host leaves.

Declare it in `osg.json` (`features.rooms`, `players`). `players.max` must be at least `rooms.maxSeats`.

## Implementation rules

- Separate simulation from rendering first; then implement the topology.
- Lobby: `quickPlay`, `create` + `showInvite`, `join(code)`, members list, ready toggles, host starts. Handle `osg.rooms.pendingInvite`.
- Send at 20-30 Hz at most with `coalesceKey`. Tiny messages (16 KiB max). Never player text or secrets.
- Host publishes `putSnapshot` about once per second; on `host` with `isSelf`, adopt the last snapshot then publish again. Declare `snapshots: true`.
- On reconnect the `epoch` increases: restart input sequence numbers.
- Use `room.serverTime()` for shared timing.
- A hidden host tab freezes the simulation and its NPCs; tell the players.
- Chat is shell-rendered (emotes and declared phrases); the game only sees activity.

## Test

`bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" dev --peers 3 --chaos latency=80-200,drop=2%`, close the host tab to test migration, then `check --players 2`. See `osg-dev`.
