/** templates/starter: a valid, rule-abiding hello-world project that auto-registers the plugin. */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sdkTarballUrl, isAllowedSdkTarballUrl, SDK_VERSION, BUILD_TEMPLATES, PLUGIN, SDK_PACKAGE, SOURCE_LIMITS, validateManifest, catalogueFeatures, declaredFeatures } from "@osg/protocol";
import { PLUGIN_ROOT, read, readJson, walk } from "./helpers";

const S = join(PLUGIN_ROOT, "templates/starter");
const manifestRaw = readJson(join(S, "osg.json"));
const result = validateManifest(manifestRaw);
const srcFiles = walk(join(S, "src")).filter((f) => /\.(ts|css)$/.test(f) && !f.endsWith(".test.ts"));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("manifest", () => {
  test("validates with no errors and no warnings", () => expect(result.issues).toEqual([]));
  test("is under the manifest size cap and uses a known build template", () => {
    expect(read(join(S, "osg.json")).length).toBeLessThan(SOURCE_LIMITS.manifestBytes);
    expect(Object.keys(BUILD_TEMPLATES)).toContain(result.manifest!.build.template);
  });
  test("exercises save, one bounded board, one achievement, rooms and an NPC brain", () => {
    const f = result.manifest!.features;
    expect(f.save).toBeDefined();
    expect(f.leaderboards).toHaveLength(1);
    expect(f.leaderboards![0]!.kind).toBe("bounded");
    expect(f.achievements).toHaveLength(1);
    expect(f.rooms).toBeDefined();
    expect(f.npcs?.brains).toHaveLength(1);
    expect(catalogueFeatures(result.manifest!)).toEqual(expect.arrayContaining(["multiplayer", "npcs", "leaderboard", "achievements", "cloud-save"]));
    expect(declaredFeatures(result.manifest!)).toEqual(expect.arrayContaining(["boards", "rooms", "npcs", "save", "achievements"]));
  });
  test("every id the code uses is declared", () => {
    const m = result.manifest!;
    const code = read(join(S, "src/main.ts"));
    for (const x of code.matchAll(/leaderboards\.(?:start|show)\("([^"]+)"/g)) expect(m.features.leaderboards!.map((b) => b.id)).toContain(x[1]!);
    for (const x of code.matchAll(/stats\.(?:inc|max)\("([^"]+)"/g)) expect(m.features.stats!.map((b) => b.id)).toContain(x[1]!);
    for (const x of code.matchAll(/brain: "([^"]+)"/g)) expect(m.features.npcs!.brains!.map((b) => b.id)).toContain(x[1]!);
    const brain = m.features.npcs!.brains![0]!;
    const game = read(join(S, "src/game.ts"));
    for (const opt of Object.keys(brain.options)) expect(game).toContain(`"${opt}"`);
  });
  test("the board bounds are consistent with the game (the game test asserts the score cap)", () => {
    const b = result.manifest!.features.leaderboards![0]!;
    expect(b.max).toBe(1500);
    expect(b.maxPerSecond).toBe(100);
    expect(read(join(S, "src/game.test.ts"))).toContain("1500");
  });
});

describe("project files", () => {
  test("package.json: private, SDK dependency, only registry specs", () => {
    const p = readJson(join(S, "package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string>; private: boolean };
    expect(p.private).toBe(true);
    const sdk = p.dependencies[SDK_PACKAGE]!;
    expect(isAllowedSdkTarballUrl(sdk)).toBe(true);
    expect(sdk).toBe(sdkTarballUrl(SDK_VERSION));
    for (const [k, v] of Object.entries({ ...p.dependencies, ...p.devDependencies })) if (k !== SDK_PACKAGE) expect(v).toMatch(/^[\^~]?\d/);
    expect(p).not.toHaveProperty("workspaces");
  });
  test(".gitignore excludes what the archive must never contain", () => {
    const g = read(join(S, ".gitignore")).split("\n");
    for (const x of ["node_modules/", "dist/", ".osg/", ".env", "*.pem", "*.key"]) expect(g).toContain(x);
  });
  test(".claude/settings.json registers this marketplace and enables the plugin", () => {
    const s = readJson(join(S, ".claude/settings.json")) as { extraKnownMarketplaces: Record<string, { source: { source: string; repo: string } }>; enabledPlugins: Record<string, boolean> };
    expect(s.extraKnownMarketplaces[PLUGIN.name]!.source).toEqual({ source: "github", repo: PLUGIN.githubRepo });
    expect(s.enabledPlugins).toEqual({ [`${PLUGIN.name}@${PLUGIN.name}`]: true });
    expect(Object.keys(s).sort()).toEqual(["enabledPlugins", "extraKnownMarketplaces"]);
  });
  test("CLAUDE.md sends Claude to the design skill and states the hard rules", () => {
    const c = read(join(S, "CLAUDE.md"));
    for (const w of ["osg-design", "osg-dev", "osg-rules", "/osg:osg-publish", "No network, no CDN", "No copyrighted", "No rude", "fallback", "purple or pink"]) expect(c).toContain(w);
  });
  test("has the files a vite project needs, and no committed build output or secrets", () => {
    for (const f of ["index.html", "package.json", "osg.json", "tsconfig.json", "CLAUDE.md", "src/main.ts", "src/game.ts", "src/game.test.ts", "src/style.css"]) expect(existsSync(join(S, f)), f).toBe(true);
    for (const f of walk(S)) expect(f).not.toMatch(/^(node_modules|dist|\.osg)\/|\.env|\.pem$|\.key$/);
  });
  test("the project fits the source limits by a wide margin", () => {
    expect(walk(S).length).toBeLessThan(50);
  });
});

describe("the game obeys the rules it teaches", () => {
  test("no network API, URL, service worker, popup or telemetry in code, markup or styles", () => {
    for (const f of [...srcFiles.map((x) => join(S, "src", x)), join(S, "index.html")]) {
      const raw = read(f);
      expect(raw, f).not.toMatch(/https?:\/\//);
      expect(strip(raw), f).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|EventSource|sendBeacon|RTCPeerConnection|serviceWorker|window\.open|importScripts|navigator\.share/);
    }
  });
  test("index.html loads only local files and has a viewport and a title", () => {
    const h = read(join(S, "index.html"));
    expect(h).toContain("<title>");
    expect(h).toContain("viewport");
    for (const m of h.matchAll(/(?:src|href)="([^"]+)"/g)) expect(m[1]!.startsWith("./")).toBe(true);
    expect(h).not.toMatch(/<script(?![^>]*src)[^>]*>\s*\S/);
  });
  test("talks to the platform only through osg; survives rejections; respects reduced motion", () => {
    const m = read(join(S, "src/main.ts"));
    expect(m).toContain(`from "${SDK_PACKAGE}"`);
    expect(m).toContain("osg.can(");
    expect(m).toContain("reducedMotion");
    expect(m).toMatch(/async function safe/);
    expect(m).toMatch(/fallback:/);
    expect(m).toContain("onSuspend");
    expect(m).not.toMatch(/innerHTML/);
  });
  test("the NPC brain world is numeric only (no text of any kind)", () => {
    const g = read(join(S, "src/game.ts"));
    const fn = /export function worldForBrain[\s\S]*?\n}\n/.exec(g)![0];
    expect(fn).not.toMatch(/name|text|chat|message/i);
  });
  test("style: no gradients and no purple or pink hues", () => {
    const hue = (hex: string): number | null => {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (d < 0.08) return null; // grey: no hue
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const css = read(join(S, "src/style.css"));
    expect(css).not.toMatch(/gradient/i);
    for (const m of css.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const h = hue(m[0]);
      if (h !== null) expect(h < 255 || h > 345, `${m[0]} hue ${Math.round(h)} is purple or pink`).toBe(true);
    }
  });
  test("fonts are never fetched: any @font-face uses a relative file", () => {
    const css = read(join(S, "src/style.css"));
    for (const m of css.matchAll(/url\(([^)]+)\)/g)) expect(m[1]!.replace(/["']/g, "")).toMatch(/^\.\//);
  });
  test("every TypeScript file at least parses", () => {
    const t = new Bun.Transpiler({ loader: "ts" });
    for (const f of walk(join(S, "src")).filter((x) => x.endsWith(".ts"))) expect(() => t.transformSync(read(join(S, "src", f))), f).not.toThrow();
  });
  test("directory listing sanity", () => {
    expect(readdirSync(S).sort()).toEqual([".claude", ".gitignore", "CLAUDE.md", "README.md", "index.html", "osg.json", "package.json", "src", "tsconfig.json"]);
  });
});

describe("regression: invites and creator terms", () => {
  test("starter joins an invite on boot and on a later invite", () => {
    const code = read(join(S, "src/main.ts"));
    expect(code).toMatch(/info\.invite/);
    expect(code).toContain("pendingInvite");
    expect(code).toContain("osg.rooms.onInvite");
    expect(code).toMatch(/osg\.rooms\.join\(/);
  });
  test("osg-publish does not stop at canCreate=false", () => {
    const skill = read(join(PLUGIN_ROOT, "skills/osg-publish/SKILL.md"));
    expect(skill).not.toMatch(/accept and stop/);
    expect(skill).toMatch(/canCreate. is false[^.]*not accepted/);
    expect(skill).toContain("create_game");
  });
});
