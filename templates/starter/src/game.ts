/**
 * Pure game simulation: no DOM, no SDK. It is deterministic for a given seed and input sequence, so it is unit-tested with `bun test`
 * and is the part you would run on the host in a multiplayer game. Rendering and platform calls live in main.ts.
 */
export interface Vec { x: number; y: number }
export interface Blob { x: number; y: number; r: number; speed: number; score: number }
export type Intent = "seek" | "shadow" | "wander";
export const INTENTS: readonly Intent[] = ["seek", "shadow", "wander"];

export const ARENA = { w: 800, h: 500 } as const;
export const ROUND_SECONDS = 30;
export const SEED_POINTS = 10;
export const MAX_SEEDS = 6;
const SPAWN_EVERY = 0.35;

export interface World {
  t: number;
  over: boolean;
  seeds: Vec[];
  me: Blob;
  rival: Blob;
  spawnIn: number;
  wanderAngle: number;
  rngState: number;
}

/** mulberry32: tiny deterministic generator. */
function next(w: World): number {
  w.rngState = (w.rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(w.rngState ^ (w.rngState >>> 15), 1 | w.rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createWorld(seed: number): World {
  return {
    t: 0,
    over: false,
    seeds: [],
    me: { x: ARENA.w * 0.3, y: ARENA.h / 2, r: 16, speed: 260, score: 0 },
    rival: { x: ARENA.w * 0.7, y: ARENA.h / 2, r: 16, speed: 200, score: 0 },
    spawnIn: 0,
    wanderAngle: 0,
    rngState: seed | 0,
  };
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function nearest(from: Vec, list: readonly Vec[]): Vec | null {
  let best: Vec | null = null;
  let bd = Infinity;
  for (const p of list) { const d = dist(from, p); if (d < bd) { bd = d; best = p; } }
  return best;
}

/** The scripted rival. This is also the brain's fallback: it must be a decent opponent with no model at all. */
export function scriptedIntent(w: World): Intent {
  return w.seeds.length > 0 ? "seek" : "wander";
}

/** What the rival brain is told. Small JSON (the limit is 4 KiB), numbers only: never player text. */
export function worldForBrain(w: World): { rival: number[]; player: number[]; seeds: number[][]; secondsLeft: number; scores: number[] } {
  const r = (n: number) => Math.round(n);
  return {
    rival: [r(w.rival.x), r(w.rival.y)],
    player: [r(w.me.x), r(w.me.y)],
    seeds: [...w.seeds].sort((a, b) => dist(w.rival, a) - dist(w.rival, b)).slice(0, 3).map((s) => [r(s.x), r(s.y)]),
    secondsLeft: Math.max(0, Math.ceil(ROUND_SECONDS - w.t)),
    scores: [w.me.score, w.rival.score],
  };
}

function move(b: Blob, dx: number, dy: number, dt: number): void {
  const len = Math.hypot(dx, dy);
  if (len > 0) { b.x += (dx / len) * b.speed * dt; b.y += (dy / len) * b.speed * dt; }
  b.x = clamp(b.x, b.r, ARENA.w - b.r);
  b.y = clamp(b.y, b.r, ARENA.h - b.r);
}

export interface StepResult { mine: number; theirs: number }

/** Advance by `dt` seconds. `input` is the player's desired direction (any length; it is normalised). */
export function step(w: World, dt: number, input: Vec, intent: Intent): StepResult {
  const out: StepResult = { mine: 0, theirs: 0 };
  if (w.over) return out;
  w.t += dt;
  move(w.me, input.x, input.y, dt);

  if (intent === "seek") {
    const s = nearest(w.rival, w.seeds);
    if (s) move(w.rival, s.x - w.rival.x, s.y - w.rival.y, dt);
  } else if (intent === "shadow") {
    move(w.rival, w.me.x - w.rival.x, w.me.y - w.rival.y, dt * 0.7);
  } else {
    w.wanderAngle += (next(w) - 0.5) * 2 * dt * 3;
    move(w.rival, Math.cos(w.wanderAngle), Math.sin(w.wanderAngle), dt * 0.5);
  }

  w.spawnIn -= dt;
  if (w.spawnIn <= 0 && w.seeds.length < MAX_SEEDS) {
    w.seeds.push({ x: 24 + next(w) * (ARENA.w - 48), y: 24 + next(w) * (ARENA.h - 48) });
    w.spawnIn = SPAWN_EVERY;
  }

  w.seeds = w.seeds.filter((s) => {
    if (dist(s, w.me) < w.me.r + 6) { w.me.score += SEED_POINTS; out.mine++; return false; }
    if (dist(s, w.rival) < w.rival.r + 6) { w.rival.score += SEED_POINTS; out.theirs++; return false; }
    return true;
  });

  if (w.t >= ROUND_SECONDS) w.over = true;
  return out;
}
