/**
 * Browser entry: input, drawing and every platform call. Game rules are in game.ts.
 * Rules for this file: talk to the platform only through `osg` (no fetch, no WebSocket); gate optional features with osg.can();
 * survive any rejected SDK call; keep everything (fonts, assets, libraries) inside the project.
 */
import { isOsgError, osg, type Room } from "@osg/sdk";
import { PERIODS, buildBoard, loadingView, type BoardRow, type BoardView, type Period } from "./board";
import { ARENA, INTENTS, ROUND_SECONDS, createWorld, scriptedIntent, step, worldForBrain, type Intent, type World } from "./game";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("stage");
const ctx = canvas.getContext("2d")!;

/** Run an SDK call and turn any rejection into null: the game keeps playing without cloud features. */
async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

let world: World = createWorld(1);
let playing = false;
let best = 0;
let intent: Intent = "wander";
let runHandle: Awaited<ReturnType<typeof osg.leaderboards.start>> | null = null;
let reducedMotion = false;
let shake = 0;
let audio: AudioContext | null = null;

// ---- input: arrows, WASD, or drag/touch toward a point
const keys = new Set<string>();
let target: { x: number; y: number } | null = null;
window.addEventListener("keydown", (e) => { keys.add(e.key.toLowerCase()); if (e.key.startsWith("Arrow")) e.preventDefault(); });
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
function toArena(e: PointerEvent) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * ARENA.w, y: ((e.clientY - r.top) / r.height) * ARENA.h };
}
canvas.addEventListener("pointerdown", (e) => { target = toArena(e); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e) => { if (target) target = toArena(e); });
canvas.addEventListener("pointerup", () => { target = null; });
canvas.addEventListener("pointercancel", () => { target = null; });

function direction() {
  let x = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
  let y = (keys.has("arrowdown") || keys.has("s") ? 1 : 0) - (keys.has("arrowup") || keys.has("w") ? 1 : 0);
  if (target && x === 0 && y === 0) { x = target.x - world.me.x; y = target.y - world.me.y; if (Math.hypot(x, y) < 6) { x = 0; y = 0; } }
  return { x, y };
}

// ---- sound: procedural, no files and no licences. Browsers need a user gesture before audio starts.
function blip(freq: number): void {
  if (!audio) return;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = "triangle";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.15, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + 0.13);
}

// ---- NPC brain: the model may suggest the rival's intent; game.ts's scripted intent is the REQUIRED fallback
const brain = osg.npcs.createBrain<Intent>({
  brain: "rival",
  npcs: () => [{ id: "rival" }],
  world: () => worldForBrain(world),
  fallback: () => scriptedIntent(world),
  onDecision: (ds) => {
    const d = ds[0];
    // validate the choice against the game's own rules before acting on it
    if (d && INTENTS.includes(d.choice) && (d.source === "fallback" || d.confidence >= 0.5)) intent = d.choice;
  },
  everyMs: 1500,
});

// ---- round lifecycle
async function startRound(): Promise<void> {
  audio ??= new AudioContext();
  void audio.resume();
  world = createWorld((Date.now() & 0xffff) + 1);
  intent = "wander";
  playing = true;
  $("panel").hidden = true;
  $("scores").hidden = true;
  $("app").classList.remove("on-scores");
  $("result").textContent = "";
  osg.lifecycle.gameplay(true);
  brain.start();
  runHandle = osg.can("boards") ? await safe(osg.leaderboards.start("main")) : null;
}

async function endRound(): Promise<void> {
  playing = false;
  brain.stop();
  osg.lifecycle.gameplay(false);
  const score = world.me.score;
  const won = score > world.rival.score;
  $("panel").hidden = false;
  $("go").textContent = "Again";
  $("result").textContent = `${won ? "You win" : score === world.rival.score ? "Tie" : "Rival wins"}: ${score} to ${world.rival.score}`;
  if (runHandle) {
    const res = await safe(osg.leaderboards.submit(runHandle, score, { durationMs: ROUND_SECONDS * 1000 }));
    if (res?.accepted) $("result").textContent += res.rank ? ` (rank ${res.rank}${res.best ? ", new best" : ""})` : "";
    runHandle = null;
  }
  if (score > best) {
    best = score;
    $("best").textContent = `Best ${best}`;
    const cur = await safe(osg.save.get("best"));
    await safe(osg.save.set("best", best, { ifVersion: cur?.meta.version ?? null }));
  }
}

// ---- frame loop
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    const r = step(world, dt, direction(), intent);
    if (r.mine > 0) {
      osg.stats.inc("seeds", r.mine);
      blip(520 + world.me.score);
      if (!reducedMotion) shake = 6;
    }
    $("score").textContent = String(world.me.score);
    $("time").textContent = String(Math.max(0, Math.ceil(ROUND_SECONDS - world.t)));
    if (world.over) void endRound();
  }
  draw();
  requestAnimationFrame(frame);
}

function draw(): void {
  const css = getComputedStyle(document.documentElement);
  ctx.clearRect(0, 0, ARENA.w, ARENA.h);
  ctx.save();
  if (shake > 0.2) { ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); shake *= 0.85; }
  ctx.fillStyle = css.getPropertyValue("--seed");
  for (const s of world.seeds) { ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = css.getPropertyValue("--rival");
  ctx.beginPath(); ctx.arc(world.rival.x, world.rival.y, world.rival.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css.getPropertyValue("--accent");
  ctx.beginPath(); ctx.arc(world.me.x, world.me.y, world.me.r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- leaderboard screen: the game draws it in its own style; the platform supplies the rows (src/board.ts shapes them).
// Names arrive already checked by the platform: draw them as plain text (textContent), and never store or send them.
let period: Period = "all";
let boardRequest = 0;

function setupScores(): void {
  const tabs = $("periods");
  for (const p of PERIODS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.label;
    b.dataset.period = p.id;
    b.addEventListener("click", () => { period = p.id; void loadScores(); });
    tabs.append(b);
  }
  $("scores-close").addEventListener("click", closeScores);
  $("scores-retry").addEventListener("click", () => { void loadScores(); });
  $("scores-signin").addEventListener("click", async () => {
    const r = await safe(osg.player.requestSignIn({ reason: "Sign in to join the daily and weekly boards" }));
    if (r?.signedIn) void loadScores();
  });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("scores").hidden) closeScores(); });
}

function openScores(): void {
  if (playing) return;
  $("panel").hidden = true;
  $("scores").hidden = false;
  $("app").classList.add("on-scores");
  void loadScores();
  ($("periods").querySelector("button[aria-pressed=true]") as HTMLElement | null ?? $("scores-close")).focus();
}

function closeScores(): void {
  boardRequest++; // ignore any answer still on its way
  $("scores").hidden = true;
  $("app").classList.remove("on-scores");
  $("panel").hidden = false;
  $("board").focus();
}

async function loadScores(): Promise<void> {
  const req = ++boardRequest;
  for (const b of $("periods").querySelectorAll<HTMLButtonElement>("button")) b.setAttribute("aria-pressed", String(b.dataset.period === period));
  paintScores(loadingView());
  let error: string | undefined;
  const grab = async <T>(p: Promise<T>): Promise<T | null> => {
    try { return await p; } catch (e) { error = isOsgError(e) ? e.code : "internal"; return null; } // the code picks the words in board.ts
  };
  // two small reads in parallel: the top of the board, and the rows around this player (with their exact rank)
  const [top, around] = await Promise.all([
    grab(osg.leaderboards.top("main", { period })).then((r) => r?.items ?? null),
    grab(osg.leaderboards.around("main", { period })),
  ]);
  if (req !== boardRequest) return; // the player switched tab or closed the screen meanwhile
  paintScores(buildBoard({ top, around, error, mode: osg.mode, guest: osg.player.current.guest, period }));
}

function paintScores(v: BoardView): void {
  $("scores-title").textContent = v.title;
  const list = $("rows");
  list.replaceChildren();
  list.classList.toggle("skeleton", v.kind === "loading");
  $("scores-status").textContent = v.kind === "ready" ? "" : v.message;
  $("you").textContent = v.kind === "ready" ? v.youText : "";
  $("scores-note").textContent = v.kind === "ready" ? v.note : "";
  $("scores-retry").hidden = !(v.kind === "unavailable" && v.retry);
  const guest = osg.mode !== "standalone" && osg.player.current.guest && osg.can("player");
  $("scores-signin").hidden = !(guest && (v.kind === "ready" || v.kind === "empty") && period !== "all");
  if (v.kind === "loading") {
    for (let i = 0; i < 5; i++) {
      const li = document.createElement("li");
      li.setAttribute("aria-hidden", "true");
      for (let k = 0; k < 4; k++) { const s = document.createElement("span"); if (k === 2) s.className = "bar"; li.append(s); }
      list.append(li);
    }
    return;
  }
  if (v.kind !== "ready") return;
  for (const r of v.rows) list.append(rowElement(r));
}

function rowElement(r: BoardRow): HTMLLIElement {
  const li = document.createElement("li");
  if (r.you) li.classList.add("me");
  if (r.gapBefore) li.classList.add("gap");
  const rank = document.createElement("span");
  rank.className = "rank";
  rank.textContent = r.rankText;
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.style.background = r.avatarColor;
  avatar.textContent = r.initial; // shown until (or instead of) the picture
  if (r.avatarUrl && osg.mode !== "standalone") { // standalone hosts have no platform art: keep the initial, skip a 404
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.onload = () => avatar.replaceChildren(img);
    img.src = r.avatarUrl; // same-origin platform art; if it cannot load, the initial stays
  }
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = r.you ? `${r.name} (you)` : r.name;
  const value = document.createElement("span");
  value.className = "value";
  value.textContent = r.valueText;
  li.append(rank, avatar, name, value);
  return li;
}

// ---- boot
async function boot(): Promise<void> {
  const info = await osg.ready();
  reducedMotion = info.platform.reducedMotion;
  osg.lifecycle.onPause(() => { playing = false; });
  osg.lifecycle.onResume(() => { if (!world.over && world.t > 0) { playing = true; last = performance.now(); } });
  osg.lifecycle.onSuspend(async () => { await safe(osg.save.flush()); });

  const saved = await safe(osg.save.get("best"));
  if (typeof saved?.value === "number") { best = saved.value; $("best").textContent = `Best ${best}`; }

  $("go").addEventListener("click", () => { void startRound(); });

  if (osg.can("boards")) {
    $("board").hidden = false;
    $("board").addEventListener("click", () => openScores());
    setupScores();
  }

  // Rooms stub: create a private room (or join the one in an invite link) and show the lobby. Nothing is synchronised yet.
  // To make it a real match, see the osg-multiplayer skill (topology, snapshots, host migration).
  if (osg.can("rooms")) {
    $("friends").hidden = false;
    const watch = (room: Room): void => {
      const text = (n: number) => `Room ${room.code ?? ""} is open. Players: ${n}`;
      $("room").textContent = text(room.members.length);
      room.on("members", (ms) => { $("room").textContent = text(ms.length); });
    };
    const joinInvite = async (code: string): Promise<void> => {
      const room = await safe(osg.rooms.join(code));
      if (!room) { $("room").textContent = "Could not join that room."; return; }
      watch(room);
    };
    $("friends").addEventListener("click", async () => {
      const room = await safe(osg.rooms.create({ public: false }));
      if (!room) { $("room").textContent = "Could not open a room right now."; return; }
      watch(room);
      await safe(room.showInvite());
    });
    // An invite link (?r=CODE, or the dev simulator's peers) arrives as info.invite or osg.rooms.pendingInvite.
    const invite = info.invite ?? osg.rooms.pendingInvite;
    if (invite) void joinInvite(invite.code);
    osg.rooms.onInvite((i) => { if (!osg.rooms.current) void joinInvite(i.code); });
  }

  osg.lifecycle.loaded();
  requestAnimationFrame(frame);
}

void boot();
