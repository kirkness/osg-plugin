import { expect, test } from "bun:test";
import { ARENA, MAX_SEEDS, ROUND_SECONDS, SEED_POINTS, createWorld, scriptedIntent, step, worldForBrain } from "./game";

const still = { x: 0, y: 0 };

test("same seed and inputs give the same world", () => {
  const a = createWorld(7);
  const b = createWorld(7);
  for (let i = 0; i < 300; i++) { step(a, 1 / 60, { x: 1, y: 0.2 }, scriptedIntent(a)); step(b, 1 / 60, { x: 1, y: 0.2 }, scriptedIntent(b)); }
  expect(a).toEqual(b);
});

test("seeds spawn up to the cap and stay inside the arena", () => {
  const w = createWorld(1);
  for (let i = 0; i < 600 && !w.over; i++) step(w, 1 / 60, still, "wander");
  expect(w.seeds.length).toBeLessThanOrEqual(MAX_SEEDS);
  for (const s of w.seeds) { expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThanOrEqual(ARENA.w); expect(s.y).toBeGreaterThanOrEqual(0); expect(s.y).toBeLessThanOrEqual(ARENA.h); }
});

test("eating a seed scores and removes it", () => {
  const w = createWorld(1);
  w.seeds.push({ x: w.me.x, y: w.me.y });
  const r = step(w, 1 / 60, still, "wander");
  expect(r.mine).toBe(1);
  expect(w.me.score).toBe(SEED_POINTS);
});

test("the round ends after ROUND_SECONDS", () => {
  const w = createWorld(3);
  for (let i = 0; i < ROUND_SECONDS * 60 + 5; i++) step(w, 1 / 60, still, "wander");
  expect(w.over).toBe(true);
});

test("the scripted rival collects seeds without any model", () => {
  const w = createWorld(5);
  for (let i = 0; i < ROUND_SECONDS * 60 && !w.over; i++) step(w, 1 / 60, still, scriptedIntent(w));
  expect(w.rival.score).toBeGreaterThan(0);
});

test("the score cannot exceed the declared board bounds (osg.json: max 1500, 100 points per second)", () => {
  const w = createWorld(9);
  // a perfect player: always steer at the nearest seed
  for (let i = 0; i < ROUND_SECONDS * 60 && !w.over; i++) {
    const s = [...w.seeds].sort((a, b) => Math.hypot(a.x - w.me.x, a.y - w.me.y) - Math.hypot(b.x - w.me.x, b.y - w.me.y))[0];
    step(w, 1 / 60, s ? { x: s.x - w.me.x, y: s.y - w.me.y } : still, scriptedIntent(w));
  }
  expect(w.me.score).toBeLessThanOrEqual(1500);
  expect(w.me.score / ROUND_SECONDS).toBeLessThanOrEqual(100);
});

test("the brain world is small and numeric", () => {
  const w = createWorld(2);
  for (let i = 0; i < 120; i++) step(w, 1 / 60, still, "wander");
  expect(JSON.stringify(worldForBrain(w)).length).toBeLessThan(1024);
});
