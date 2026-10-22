/**
 * Generates docs/author/limits.md from LIMITS in @osg/protocol, so the numbers authors read can never drift from the numbers the platform enforces.
 *
 *   bun plugin/scripts/gen-limits.ts           write docs/author/limits.md
 *   bun plugin/scripts/gen-limits.ts --check   exit 1 if the committed file is stale
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LIMITS } from "@osg/protocol";

export const LIMITS_DOC_PATH = resolve(import.meta.dir, "../../docs/author/limits.md");

const KIB = 1024;
const MIB = 1024 * 1024;

/** 16384 -> "16 KiB", 25165824 -> "24 MiB". Only exact multiples are abbreviated. */
export function bytes(n: number): string {
  if (n >= MIB && n % MIB === 0) return `${n / MIB} MiB`;
  if (n >= KIB && n % KIB === 0) return `${n / KIB} KiB`;
  return `${n} bytes`;
}
export function duration(ms: number): string {
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) return `${ms / 3_600_000} h`;
  if (ms >= 60_000 && ms % 60_000 === 0) return `${ms / 60_000} min`;
  if (ms >= 1000 && ms % 1000 === 0) return `${ms / 1000} s`;
  return `${ms} ms`;
}

/** The value column: raw number plus a human reading when the key name says what the unit is. */
export function formatValue(key: string, v: unknown): string {
  if (Array.isArray(v)) return `\`${JSON.stringify(v)}\``;
  if (typeof v === "number") {
    const k = key.split(".").pop() ?? key;
    if (/bytes/i.test(k) || /^max(DataFrame|Snapshot|AttachmentFrame)$/.test(k)) return `${v} (${bytes(v)})`;
    if (/Ms$/.test(k)) return `${v} (${duration(v)})`;
    return String(v);
  }
  return `\`${String(v)}\``;
}

/** Platform-internal tuning (abuse controls, spend caps, review internals) that authors cannot act on and attackers could use: never published. */
export const INTERNAL_ONLY: readonly (string | RegExp)[] = [
  "room.ticketTtlSec", "room.ticketSkewSec", "room.evidenceRows", "room.evidenceRetentionMs",
  /^npc\.(perGameDailyUsd|globalDailyUsd|globalCallsPer60s|usdPerMInputTokens|circuitBreakerMs)$/,
  /^verify\.(maxTokens|browserConcurrency|blockConfidence|topicDrift|canary)/,
  /^auth\./,
];
const isInternal = (path: string): boolean => INTERNAL_ONLY.some((p) => (typeof p === "string" ? p === path : p.test(path)));

type Row = [path: string, value: string];
function flatten(prefix: string, v: unknown, out: Row[]): void {
  if (isInternal(prefix)) return;
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(prefix ? `${prefix}.${k}` : k, x, out);
  } else out.push([prefix, formatValue(prefix, v)]);
}

const SECTIONS: { key: keyof typeof LIMITS; title: string; blurb: string }[] = [
  { key: "room", title: "Rooms (multiplayer relay)", blurb: "Enforced by the room relay. Exceeding a bucket slows you down; abuse closes the socket." },
  { key: "bridge", title: "Bridge (game to shell messages)", blurb: "Every SDK call travels over this channel. Oversized or malformed frames count as strikes." },
  { key: "save", title: "Cloud saves", blurb: "Members only. Guests save in their own browser instead." },
  { key: "board", title: "Leaderboards", blurb: "Per board and per player." },
  { key: "achievement", title: "Achievements and stats", blurb: "Per game." },
  { key: "npc", title: "NPC decisions", blurb: "The platform budgets decisions. Every limit hit answers with your scripted fallback, never an error." },
  { key: "source", title: "Source archive and build", blurb: "What `osg pack` may produce and what the server build may output." },
  { key: "verify", title: "Verification and submissions", blurb: "How many submissions you may have, and how the review run is bounded." },
  { key: "rank", title: "Global ranking", blurb: "Eligibility and scoring constants of the cross-game ranking." },
  { key: "analytics", title: "Analytics", blurb: "Custom events and the dashboard window." },
  { key: "catalogue", title: "Catalogue text", blurb: "Lengths of the strings people see on game cards." },
];

export function renderLimits(l: typeof LIMITS = LIMITS): string {
  const L = l;
  const out: string[] = [];
  out.push("---");
  out.push("title: Limits and quotas");
  out.push("summary: Every number the platform enforces: seats, message rates, save sizes, board bounds, NPC budgets, source and build caps, submission quotas.");
  out.push("tags: [limits, quotas, rooms, saves, boards, npcs, build]");
  out.push("---");
  out.push("");
  out.push("# Limits and quotas");
  out.push("");
  out.push("<!-- Generated from LIMITS in @osg/protocol by plugin/scripts/gen-limits.ts. Do not edit by hand. -->");
  out.push("");
  out.push("These are the real numbers, generated from the same constants the platform enforces. `osg dev --strict` applies them locally.");
  out.push("");
  out.push("## Cheat sheet");
  out.push("");
  out.push(`- A room has at most **${L.seats} seats**, NPC seats included.`);
  out.push(`- Send at most **${L.room.sendHzMax} updates per second** per player; the room accepts ${L.room.msgPerSecPerSocket} messages/s per socket (burst ${L.room.msgBurstPerSocket}) and ${bytes(L.room.bytesPerSecPerSocket)}/s.`);
  out.push(`- One room message is at most **${bytes(L.room.maxDataFrame)}**; a host snapshot at most **${bytes(L.room.maxSnapshot)}**, at most once per ${duration(L.room.snapshotMinIntervalMs)}.`);
  out.push(`- A room lives at most **${duration(L.room.roomLifetimeMs)}**. A dropped player keeps their seat for ${duration(L.room.reconnectGraceMs)}.`);
  out.push(`- A save value is at most **${bytes(L.save.maxValueBytes)}**, a player's saves for one game at most ${bytes(L.save.maxBytesPerPlayerGame)} across ${L.save.maxKeys} keys. The server writes at most once per key per ${duration(L.save.writeCoalesceMs)}.`);
  out.push(`- At most **${L.board.maxBoardsPerGame} boards** per game; a board shows the top ${L.board.showTopMax} at most, plus ${L.board.showAroundMax} rows around the player at most.`);
  out.push(`- A world sent to an NPC brain is at most **${bytes(L.npc.worldMaxBytes)}**, with at most ${L.npc.maxNpcsPerCall} NPCs per call, ${L.npc.maxBrainsPerGame} brains per game and ${L.npc.maxOptions} options per brain. One room gets ${L.npc.perRoom.perSec} decision per second (burst ${L.npc.perRoom.burst}); one player ${L.npc.perUserPerMin} per minute.`);
  out.push(`- Your source zip is at most **${bytes(L.source.zipBytes)}** (${bytes(L.source.unpackedBytes)} unpacked, ${L.source.files} files). The built game is at most ${bytes(L.source.outputBytes)} and ${L.source.outputFiles} files; one file at most ${bytes(L.source.outputSingleFileBytes)}.`);
  out.push(`- You may submit **${L.verify.perAuthorSubmissionsPerDay} times per day** with at most **${L.verify.perAuthorOpenSubmissions} open** at once. Verification gives up after ${duration(L.verify.deadlineMs)}.`);
  out.push(`- Rejected source is deleted ${L.verify.rejectedRetentionDays} days after the verdict.`);
  out.push("");
  for (const s of SECTIONS) {
    const rows: Row[] = [];
    flatten(s.key, L[s.key], rows);
    out.push(`## ${s.title}`);
    out.push("");
    out.push(s.blurb);
    out.push("");
    out.push("| Limit | Value |");
    out.push("| --- | --- |");
    for (const [p, v] of rows) out.push(`| \`${p}\` | ${v} |`);
    out.push("");
  }
  return out.join("\n");
}

if (import.meta.main) {
  const text = renderLimits();
  if (process.argv.includes("--check")) {
    if (!existsSync(LIMITS_DOC_PATH) || readFileSync(LIMITS_DOC_PATH, "utf8") !== text) { console.error("docs/author/limits.md is stale: run `bun plugin/scripts/gen-limits.ts`"); process.exit(1); }
    console.log("docs/author/limits.md is up to date");
  } else {
    writeFileSync(LIMITS_DOC_PATH, text);
    console.log(`wrote ${LIMITS_DOC_PATH}`);
  }
}
