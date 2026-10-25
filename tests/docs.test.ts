/** docs/author: every DOC_SLUGS entry and PLAYBOOKS entry exists, the content rules hold, numbers match LIMITS. */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DOC_SLUGS, LIMITS, PLAYBOOKS, PLUGIN, validateManifest } from "@osg/protocol";
import { renderLimits } from "../scripts/gen-limits";
import { DOCS_DIR, REPO_ROOT, fences, frontmatter, publicTextFiles, read } from "./helpers";

const docPath = (s: string) => join(DOCS_DIR, `${s}.md`);
const pbPath = (s: string) => join(DOCS_DIR, "playbooks", `${s}.md`);
const KIB = 1024;

describe("coverage", () => {
  test("a doc for every DOC_SLUGS entry and nothing else", () => {
    for (const s of DOC_SLUGS) expect(existsSync(docPath(s)), s).toBe(true);
    const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
    expect(files.sort()).toEqual([...DOC_SLUGS].sort());
  });
  test("a playbook for every PLAYBOOKS entry and nothing else", () => {
    for (const s of PLAYBOOKS) expect(existsSync(pbPath(s)), s).toBe(true);
    const files = readdirSync(join(DOCS_DIR, "playbooks")).map((f) => f.slice(0, -3));
    expect(files.sort()).toEqual([...PLAYBOOKS].sort());
  });
  test("frontmatter: title, one-line summary, tags", () => {
    for (const p of [...DOC_SLUGS.map(docPath), ...PLAYBOOKS.map(pbPath)]) {
      const fm = frontmatter(read(p));
      expect(fm, p).not.toBeNull();
      expect(fm!.meta.title?.length, `${p} title`).toBeGreaterThan(3);
      expect(fm!.meta.summary?.length, `${p} summary`).toBeGreaterThan(30);
      expect(fm!.meta.summary!.length, `${p} summary`).toBeLessThanOrEqual(240);
      expect(fm!.meta.tags, `${p} tags`).toMatch(/^\[[a-z0-9-]+(, [a-z0-9-]+)*\]$/);
      expect(fm!.body, `${p} heading`).toMatch(/^\s*# /);
    }
  });
  test("playbooks have a numbered Steps section of single-line steps", () => {
    for (const s of PLAYBOOKS) {
      const body = frontmatter(read(pbPath(s)))!.body;
      const steps = /## Steps\n\n([\s\S]*?)(\n## |$)/.exec(body);
      expect(steps, s).not.toBeNull();
      const lines = steps![1]!.trim().split("\n");
      expect(lines.length, s).toBeGreaterThanOrEqual(8);
      lines.forEach((l, i) => expect(l.startsWith(`${i + 1}. `), `${s} line ${i + 1}`).toBe(true));
    }
  });
  test("the MCP docs bundler accepts everything with nothing missing", async () => {
    const script = join(REPO_ROOT, "workers/mcp/scripts/build-docs.ts");
    if (!existsSync(script)) return; // the auth task may not have landed
    const { buildBundle } = (await import(script)) as { buildBundle: (root: string, log: (m: string) => void) => { docs: { slug: string; title: string; summary: string; tags: string[] }[]; playbooks: { name: string; title: string; summary: string; tags: string[] }[] } };
    const logs: string[] = [];
    const b = buildBundle(REPO_ROOT, (m) => logs.push(m));
    expect(logs).toEqual([]);
    expect(b.docs).toHaveLength(DOC_SLUGS.length);
    expect(b.playbooks).toHaveLength(PLAYBOOKS.length);
    for (const d of [...b.docs, ...b.playbooks]) { expect(d.title.length).toBeGreaterThan(3); expect(d.summary.length).toBeGreaterThan(30); expect(d.tags.length).toBeGreaterThan(0); }
  });
});

describe("limits.md is generated", () => {
  test("committed file equals the generator output (run `bun plugin/scripts/gen-limits.ts`)", () => {
    expect(read(docPath("limits"))).toBe(renderLimits());
  });
  test("it carries the real numbers", () => {
    const t = read(docPath("limits"));
    expect(t).toContain(`\`room.maxDataFrame\` | ${LIMITS.room.maxDataFrame} (16 KiB)`);
    expect(t).toContain(`**${LIMITS.verify.perGameSubmissionsPerDay} times per day** (${LIMITS.verify.perAuthorSubmissionsPerDay} across all your games)`);
    expect(t).toContain(`**${LIMITS.seats} seats**`);
  });
  test("platform-internal tuning is not published", () => {
    const t = read(docPath("limits"));
    for (const w of ["globalDailyUsd", "perGameDailyUsd", "usdPerMInputTokens", "canary", "browserConcurrency", "blockConfidence", "otpGlobalPerHour", "ticketTtl", "maxTokensHaiku"]) expect(t).not.toContain(w);
  });
});

describe("hand-written numbers match LIMITS", () => {
  const has = (file: string, text: string) => expect(read(docPath(file)), `${file}: ${text}`).toContain(text);
  test("multiplayer", () => {
    has("multiplayer", `**${LIMITS.seats} seats, NPCs included**`);
    has("multiplayer", `${LIMITS.room.maxDataFrame / KIB} KiB`);
    has("multiplayer", `${LIMITS.room.maxSnapshot / KIB} KiB`);
    has("multiplayer", `${LIMITS.room.reconnectGraceMs / 1000} seconds`);
    has("multiplayer", `${LIMITS.room.hostMigrationSilenceMs / 1000} seconds`);
    has("multiplayer", `${LIMITS.room.msgPerSecPerRoom} messages per second`);
  });
  test("saves and npcs", () => {
    has("sdk", `${LIMITS.save.maxValueBytes / KIB} KiB`);
    has("npcs", `**${LIMITS.npc.worldMaxBytes / KIB} KiB**`);
    has("npcs", `up to **${LIMITS.npc.maxNpcsPerCall} NPCs**`);
    has("npcs", `${LIMITS.npc.perUserPerMin} per minute`);
    has("npcs", `${LIMITS.npc.maxOptions} options`);
    has("npcs", `${LIMITS.npc.optionLabelMax}`);
    has("npcs", `${LIMITS.npc.optionDescMax}`);
    has("npcs", `${LIMITS.npc.questionMax}`);
    has("npcs", `floor ${LIMITS.npc.minIntervalMsPerSession}`);
  });
  test("scores and manifest", () => {
    has("scores", `At most ${LIMITS.board.maxBoardsPerGame} boards`);
    has("scores", `(1-${LIMITS.board.showTopMax})`);
    has("scores", `(0-${LIMITS.board.showAroundMax})`);
    has("scores", `At most ${LIMITS.achievement.max} achievements and ${LIMITS.achievement.stats} stats`);
    has("scores", `at least ${LIMITS.board.holdMinEntries} entries`);
    has("manifest", `${LIMITS.board.maxBoardsPerGame}`);
    has("manifest", `${LIMITS.source.manifestBytes / KIB} KiB`);
  });
  test("publish and rules", () => {
    has("publish", `${LIMITS.verify.deadlineMs / 60000}`);
    has("rules", `${LIMITS.verify.rejectedRetentionDays} days`);
    has("publish", "10-20");
    has("getting-started", PLUGIN.minClaudeCode);
  });
});

describe("content rules", () => {
  const files = publicTextFiles().filter((f) => !f.includes("/node_modules/"));

  test("manifests in docs validate (and bounded boards are bounded)", () => {
    for (const s of DOC_SLUGS) {
      for (const f of fences(read(docPath(s))).filter((x) => x.lang === "json" && x.body.includes("manifestVersion"))) {
        const r = validateManifest(JSON.parse(f.body));
        expect(r.issues, `${s}: ${JSON.stringify(r.issues)}`).toEqual([]);
      }
    }
  });

  test("code samples in docs and skills never load anything from a URL", () => {
    for (const f of files.filter((x) => x.endsWith(".md"))) {
      for (const b of fences(read(f))) for (const m of b.body.matchAll(/https?:\/\/[^\s"')]+/g)) expect(m[0], `${f}`).toMatch(/bun\.sh|oursilly\.games\/sdk\//);
    }
  });

  test("nothing teaches fetch, WebSocket or a CDN (mentions must be prohibitions)", () => {
    for (const f of files.filter((x) => x.endsWith(".md") && !x.endsWith("troubleshooting.md") && !x.endsWith("rules.md"))) {
      for (const b of fences(read(f))) {
        expect(b.body, f).not.toMatch(/\bfetch\(|new WebSocket|XMLHttpRequest|sendBeacon|<script[^>]+src=["']http|cdn\.|jsdelivr|unpkg|cdnjs|googleapis/);
      }
    }
  });

  test("no purple or pink gradients, and purple or pink only ever appear as something banned", () => {
    for (const f of files) {
      const text = read(f);
      expect(text, f).not.toMatch(/(linear|radial|conic)-gradient\(/);
      for (const line of text.split("\n")) if (/purple|pink|violet|magenta/i.test(line)) expect(line, `${f}: ${line}`).toMatch(/ban|no |never|remove|replace|avoid|read as|default/i);
    }
  });

  test("no copyrighted franchise names in anything shipped", () => {
    const names = /\b(mario|pok[eé]mon|zelda|sonic the|minecraft|fortnite|roblox|among us|angry birds|flappy bird|disney|marvel|star wars|harry potter|nintendo|sega|pac-?man|space invaders|call of duty)\b/i;
    for (const f of files) {
      const text = read(f);
      // the rules docs may name them once as examples of what not to do; shipped examples and code may not
      if (/rules\.md$|osg-rules|troubleshooting\.md/.test(f)) continue;
      expect(text, f).not.toMatch(names);
    }
  });

  test("nothing internal leaks into public text", () => {
    const secrets = /daecce56|K_PLAYER|K_LAUNCH|K_UPLOAD|K_ANALYTICS|K_RUN|TICKET_PRIV|BETTER_AUTH_SECRET|AIG_TOKEN|TURNSTILE_SECRET|workers\.dev|\/Users\/|roger@|BEGIN [A-Z ]*PRIVATE KEY|osg-state|osg-rooms|osg-verify|Durable Object/;
    for (const f of files) expect(read(f), f).not.toMatch(secrets);
  });

  test("the teaching rules are present", () => {
    const rules = read(docPath("rules"));
    expect(rules).toContain("EXT_CDN_ASSET");
    expect(rules).toMatch(/no CDN of any kind/);
    expect(rules).toContain("Pre-flight checklist");
    expect(read(docPath("multiplayer"))).toMatch(/not\*\* suitable for competitive|\*\*not\*\* suitable for competitive/);
    expect(read(docPath("multiplayer"))).toContain("150-300 ms");
    expect(read(docPath("multiplayer"))).toMatch(/never count for the global ranking/);
    expect(read(docPath("scores"))).toContain("never count toward the global ranking");
    expect(read(docPath("scores"))).toContain("bounds");
    const npcs = read(docPath("npcs"));
    expect(npcs).toMatch(/scripted baseline comes first/);
    expect(npcs).toContain("REQUIRED");
    expect(npcs).toContain("Never");
    expect(npcs).toContain("NO_FALLBACK_NPC");
    expect(read(docPath("assets"))).toContain("Everything ships inside your project");
    expect(read(docPath("getting-started"))).toContain("ultracode");
    expect(read(docPath("design"))).toContain("Banned defaults");
    expect(read(docPath("design"))).toContain("Scoring rubric");
  });

  test("every finding code in protocol is explained in troubleshooting", async () => {
    const { ALL_FINDING_CODES } = await import("@osg/protocol");
    const t = read(docPath("troubleshooting"));
    // codes the platform never shows an author as a fix target are still listed; only these deterministic/system ones are required
    for (const c of ALL_FINDING_CODES) expect(t, c).toContain(c);
  });

  test("docs only name CLI commands that exist", () => {
    const known = new Set(["init", "dev", "check", "shot", "validate", "build", "pack", "login", "submit", "status", "stop", "upload", "update-sdk"]);
    for (const f of files.filter((x) => x.endsWith(".md"))) {
      for (const m of read(f).matchAll(/`osg ([a-z]+(?:-sdk)?)[^`]*`/g)) expect(known.has(m[1]!), `${f}: osg ${m[1]}`).toBe(true);
    }
  });
});
