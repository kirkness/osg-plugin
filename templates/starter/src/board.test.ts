import { expect, test } from "bun:test";
import type { BoardEntry } from "@osg/sdk";
import { PERIODS, buildBoard, errorMessage, loadingView, rankText, toRow, type BoardData } from "./board";

const entry = (rank: number, name: string, value: number, you = false): BoardEntry => ({
  rank, name, value, you, at: 0, avatar: { id: "frog", url: "/__osg/avatars/frog.png", color: "#7bc043" },
});
const base: BoardData = { top: [], around: { entries: [], selfRank: null }, mode: "hosted", guest: false, period: "all" };

test("top rows come back in rank order, capped, with the player's row flagged", () => {
  const top = [entry(2, "Bo", 900), entry(1, "Ada", 1200), entry(3, "You", 800, true), entry(4, "Cy", 700)];
  const v = buildBoard({ ...base, top, around: { entries: [entry(3, "You", 800, true)], selfRank: 3 } }, 3);
  expect(v.kind).toBe("ready");
  if (v.kind !== "ready") return;
  expect(v.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  expect(v.rows.filter((r) => r.you)).toHaveLength(1);
  expect(v.youText).toBe("You are #3 with 800");
  expect(v.rows.some((r) => r.gapBefore)).toBe(false);
});

test("a player below the top list appears after a gap, with their neighbours, once", () => {
  const top = [entry(1, "Ada", 1200), entry(2, "Bo", 900)];
  const around = { entries: [entry(41, "Di", 300), entry(42, "You", 290, true), entry(43, "Ed", 280)], selfRank: 42 };
  const v = buildBoard({ ...base, top, around });
  if (v.kind !== "ready") throw new Error(v.kind);
  expect(v.rows.map((r) => r.rank)).toEqual([1, 2, 41, 42, 43]);
  expect(v.rows.map((r) => r.gapBefore)).toEqual([false, false, true, false, false]);
  expect(v.youText).toBe("You are #42 with 290");
});

test("rows that overlap between top() and around() are not repeated", () => {
  const top = [entry(1, "You", 50, true), entry(2, "Bo", 40)];
  const v = buildBoard({ ...base, top, around: { entries: [entry(1, "You", 50, true), entry(2, "Bo", 40)], selfRank: 1 } });
  if (v.kind !== "ready") throw new Error(v.kind);
  expect(v.rows).toHaveLength(2);
});

test("empty, loading and unavailable states have friendly words and no jargon", () => {
  expect(buildBoard(base).kind).toBe("empty");
  expect(buildBoard({ ...base, period: "day" })).toMatchObject({ kind: "empty", message: expect.stringContaining("today") });
  expect(loadingView().kind).toBe("loading");
  const off = buildBoard({ ...base, top: null, around: null, error: "offline" });
  expect(off).toMatchObject({ kind: "unavailable", retry: true });
  expect(buildBoard({ ...base, top: null, around: null, error: "killed" })).toMatchObject({ kind: "unavailable", retry: false });
  for (const code of ["offline", "timeout", "rate_limited", "killed", "internal", undefined]) {
    expect(errorMessage(code).message).not.toMatch(/error|code|http|port|_|undefined/i);
  }
});

test("if one call fails the other still fills the board", () => {
  const v = buildBoard({ ...base, top: [entry(1, "Ada", 10)], around: null });
  expect(v.kind).toBe("ready");
  if (v.kind === "ready") expect(v.youText).toBe("Play a round to get on the board.");
});

test("standalone and guest notes", () => {
  const top = [entry(1, "You", 10, true)];
  const s = buildBoard({ ...base, top, mode: "standalone" });
  expect(s.kind === "ready" && s.note).toContain("this device");
  const g = buildBoard({ ...base, top, guest: true, period: "week" });
  expect(g.kind === "ready" && g.note).toContain("Sign in");
});

test("rows carry what the game needs to draw them", () => {
  const r = toRow(entry(7, "  zed ", 1234567));
  expect(r).toMatchObject({ name: "zed", initial: "Z", rankText: "7", valueText: "1,234,567", avatarUrl: "/__osg/avatars/frog.png", avatarColor: "#7bc043" });
  expect(toRow(entry(1, "", 1)).name).toBe("Player");
  expect(rankText(5000)).toBe("1000+");
  expect(PERIODS.map((p) => p.id)).toEqual(["all", "week", "day"]);
});

test("a player tied with the last top row still gets their highlighted row", () => {
  const top = [entry(1, "Ada", 50), entry(2, "Bo", 40)];
  const around = { entries: [entry(2, "Bo", 40), entry(2, "You", 40, true), entry(4, "Cy", 30)], selfRank: 2 };
  const v = buildBoard({ ...base, top, around });
  if (v.kind !== "ready") throw new Error(v.kind);
  expect(v.rows.map((r) => r.name)).toEqual(["Ada", "Bo", "You", "Cy"]);
  expect(v.rows.filter((r) => r.you)).toHaveLength(1);
  expect(v.rows.map((r) => r.gapBefore)).toEqual([false, false, false, true]);
  expect(v.youText).toBe("You are #2 with 40");
});

test("a failed top list with nothing around the player reads as unavailable, not as an empty board", () => {
  const v = buildBoard({ ...base, top: null, around: { entries: [], selfRank: null }, error: "offline" });
  expect(v).toMatchObject({ kind: "unavailable", retry: true });
});
