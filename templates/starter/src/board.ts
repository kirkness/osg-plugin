/**
 * The leaderboard screen's view model: pure, no DOM, no SDK calls (unit-tested in board.test.ts).
 * The platform stays the source of truth: main.ts fetches rows with osg.leaderboards.top() and around(), this file turns them into
 * what the game draws (rows, the player's own line, empty/loading/offline messages), and main.ts paints it in the game's own style.
 * Names come from the platform already checked: draw them as text exactly as given, never store or send them.
 */
import type { BoardEntry } from "@osg/sdk";

export type Period = "all" | "week" | "day";
/** Must match `periods` of the board in osg.json. */
export const PERIODS: readonly { id: Period; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "week", label: "This week" },
  { id: "day", label: "Today" },
];

export interface BoardRow {
  key: string;
  rank: number;
  rankText: string;
  name: string;
  /** shown when the avatar picture cannot load (standalone mode, a slow network) */
  initial: string;
  avatarUrl: string;
  avatarColor: string;
  valueText: string;
  you: boolean;
  /** true on the first row after a jump in rank (the "around you" rows below the top list) */
  gapBefore: boolean;
}

export type BoardView =
  | { kind: "loading"; title: string; message: string }
  | { kind: "unavailable"; title: string; message: string; retry: boolean }
  | { kind: "empty"; title: string; message: string }
  | { kind: "ready"; title: string; rows: BoardRow[]; youText: string; note: string };

/** What main.ts gathered. `null` means that call failed or was not made. */
export interface BoardData {
  top: BoardEntry[] | null;
  around: { entries: BoardEntry[]; selfRank: number | null } | null;
  /** OsgError code of the failure, when both calls failed */
  error?: string;
  mode: "hosted" | "dev" | "standalone";
  guest: boolean;
  period: Period;
}

const TITLE = "Best round";
const fmt = (n: number): string => (Number.isFinite(n) ? Math.round(n).toLocaleString("en") : "-");

export function rankText(rank: number): string {
  if (!Number.isFinite(rank) || rank < 1) return "-";
  return rank > 1000 ? "1000+" : String(rank); // exact ranks stop at 1000; beyond that the platform bands them
}

export function toRow(e: BoardEntry, gapBefore = false): BoardRow {
  const name = (e.name ?? "").trim() || "Player";
  return {
    key: `${e.rank}:${e.you ? "you" : name}:${e.value}`,
    rank: e.rank,
    rankText: rankText(e.rank),
    name,
    initial: [...name][0]!.toUpperCase(),
    avatarUrl: e.avatar?.url ?? "",
    avatarColor: e.avatar?.color ?? "#8a94a0",
    valueText: fmt(e.value),
    you: !!e.you,
    gapBefore,
  };
}

export function loadingView(): BoardView {
  return { kind: "loading", title: TITLE, message: "Fetching scores..." };
}

/** Friendly words for an SDK error code. No codes, ports or jargon reach the player. */
export function errorMessage(code: string | undefined): { message: string; retry: boolean } {
  switch (code) {
    case "offline":
    case "timeout":
    case "unavailable":
      return { message: "Can't reach the scores right now. Check your connection and try again.", retry: true };
    case "rate_limited":
      return { message: "Too many looks at once. Try again in a moment.", retry: true };
    case "sign_in_required":
    case "permission_denied":
      return { message: "Sign in to see this board.", retry: false };
    case "killed":
    case "not_declared":
    case "unsupported":
      return { message: "Leaderboards are switched off for this game.", retry: false };
    default:
      return { message: "The scores didn't load. Try again.", retry: true };
  }
}

/**
 * Top rows first, then (if the player is further down) a gap and the rows around them. Duplicates are dropped, so the player's
 * own row appears once and is flagged `you`.
 */
export function buildBoard(d: BoardData, maxTop = 10): BoardView {
  if (d.top === null && d.around === null) {
    const e = errorMessage(d.error);
    return { kind: "unavailable", title: TITLE, ...e };
  }
  const top = (d.top ?? []).slice().sort((a, b) => a.rank - b.rank).slice(0, maxTop);
  const seen = new Set<string>();
  const rows: BoardRow[] = [];
  for (const e of top) {
    const r = toRow(e);
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    rows.push(r);
  }
  const lastTop = rows.length ? rows[rows.length - 1]!.rank : 0;
  const near = (d.around?.entries ?? []).slice().sort((a, b) => a.rank - b.rank).filter((e) => e.rank >= lastTop); // >= keeps a player tied with the last top row (duplicates drop below)
  let prev = lastTop;
  for (const e of near) {
    const r = toRow(e, rows.length > 0 && e.rank > prev + 1);
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    rows.push(r);
    prev = e.rank;
  }
  // a player shown in the top list by name may also come back flagged `you` in around(): trust the flag
  const mine = rows.find((r) => r.you);
  const selfRank = d.around?.selfRank ?? mine?.rank ?? null;

  const note = d.mode === "standalone" ? "Scores on this device only." : d.guest && d.period !== "all" ? "Guests appear on the all-time board. Sign in to join daily and weekly boards." : "";
  if (rows.length === 0) {
    // the top list failed and around() had nothing to add: that is "couldn't load", not "no scores yet"
    if (d.top === null) return { kind: "unavailable", title: TITLE, ...errorMessage(d.error) };
    const message = d.period === "day" ? "No scores today yet. Set the first one!" : d.period === "week" ? "No scores this week yet. Set the first one!" : "No scores yet. Play a round to put your name up here.";
    return { kind: "empty", title: TITLE, message };
  }
  const youText = selfRank ? `You are #${rankText(selfRank)}${mine ? ` with ${mine.valueText}` : ""}` : "Play a round to get on the board.";
  return { kind: "ready", title: TITLE, rows, youText, note };
}
