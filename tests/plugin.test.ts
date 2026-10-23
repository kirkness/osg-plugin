/**
 * Structure of the plugin: manifests, MCP config, hook, skills. Section 19 of docs/v1/SPEC.md:
 * valid JSON, skills reference only existing MCP tools and doc slugs, no top-level bin/, frontmatter present.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DOC_SLUGS, HOSTS, MCP_TOOLS, PLAYBOOKS, PLUGIN } from "@osg/protocol";
import { PLUGIN_ROOT, frontmatter, read, readJson, walk } from "./helpers";

const SKILL_NAMES = ["osg-start", "osg-design", "osg-sdk", "osg-dev", "osg-multiplayer", "osg-npcs", "osg-scores", "osg-rules", "osg-publish", "osg-assets"];
const CLI_COMMANDS = ["init", "dev", "check", "shot", "validate", "build", "pack", "login", "submit", "status", "stop", "upload", "update-sdk", "--help", "--version"];
/** snake_case words skills may legitimately put in backticks that are not MCP tools: SDK error codes (sdk-types.ts OsgErrorCode) and a folder name. */
const NON_TOOL_TOKENS = new Set(["not_ready", "unsupported", "not_declared", "sign_in_required", "permission_denied", "rate_limited", "quota_exceeded", "invalid_argument", "too_large", "conflict", "not_found", "timeout", "cancelled", "offline", "killed", "unavailable", "internal", "node_modules"]);
const SEMVER = /^\d+\.\d+\.\d+$/;

describe("manifests", () => {
  const plugin = readJson(join(PLUGIN_ROOT, ".claude-plugin/plugin.json")) as Record<string, unknown>;
  const market = readJson(join(PLUGIN_ROOT, ".claude-plugin/marketplace.json")) as { name: string; description: string; owner: { name: string }; plugins: Record<string, unknown>[] };

  test("plugin.json", () => {
    expect(plugin.name).toBe(PLUGIN.name);
    expect(plugin.displayName).toBe(PLUGIN.displayName);
    expect(String(plugin.version)).toMatch(SEMVER);
    expect(plugin.homepage).toBe(`https://${HOSTS.site}`);
    expect(plugin.repository).toBe(`https://github.com/${PLUGIN.githubRepo}`);
    expect(String(plugin.name)).not.toMatch(/^(claude|anthropic)/);
    expect(String(plugin.description).length).toBeGreaterThan(20);
    expect(plugin.privacyPolicyUrl).toBe(`https://${HOSTS.site}/privacy`);
    expect(plugin).not.toHaveProperty("bin");
  });

  test("marketplace.json: one entry with a RELATIVE source so project settings can auto-register it", () => {
    expect(market.name).toBe(PLUGIN.name);
    expect(market.owner.name.length).toBeGreaterThan(0);
    expect(market.description.length).toBeGreaterThan(20);
    expect(market.plugins).toHaveLength(1);
    const e = market.plugins[0]!;
    expect(e.name).toBe(PLUGIN.name);
    expect(e.source).toBe("./");
    // the version lives in plugin.json only (setting both is an error in Claude Code)
    expect(e).not.toHaveProperty("version");
  });

  test(".claude-plugin holds only the two manifests", () => {
    expect(readdirSync(join(PLUGIN_ROOT, ".claude-plugin")).sort()).toEqual(["marketplace.json", "plugin.json"]);
  });

  test("the install command in protocol names the same marketplace and plugin", () => {
    expect(PLUGIN.installCommand).toBe(`claude plugin install ${PLUGIN.name} --marketplace ${PLUGIN.githubRepo}`);
  });
});

describe(".mcp.json", () => {
  const mcp = readJson(join(PLUGIN_ROOT, ".mcp.json")) as { mcpServers: Record<string, Record<string, unknown>> };
  test("two servers, constant urls, http type, no Authorization", () => {
    expect(Object.keys(mcp.mcpServers).sort()).toEqual(["osg", "osg-docs"]);
    expect(mcp.mcpServers.osg).toEqual({ type: "http", url: `https://${HOSTS.mcp}/mcp` });
    expect(mcp.mcpServers["osg-docs"]).toEqual({ type: "http", url: `https://${HOSTS.mcp}/docs` });
    // an Authorization header would stop Claude Code falling back to OAuth
    expect(read(join(PLUGIN_ROOT, ".mcp.json")).toLowerCase()).not.toContain("authorization");
  });
  test("server names match the MCP_TOOLS server field", () => {
    const servers = new Set(Object.values(MCP_TOOLS).map((t) => t.server));
    expect([...servers].sort()).toEqual(["osg", "osg-docs"]);
  });
});

describe("hooks", () => {
  const hooks = readJson(join(PLUGIN_ROOT, "hooks/hooks.json")) as { hooks: Record<string, { hooks: { type: string; command: string; timeout?: number }[] }[]> };
  test("exactly one SessionStart command hook and nothing else", () => {
    expect(Object.keys(hooks.hooks)).toEqual(["SessionStart"]);
    const groups = hooks.hooks.SessionStart!;
    expect(groups).toHaveLength(1);
    expect(groups[0]!.hooks).toHaveLength(1);
    const h = groups[0]!.hooks[0]!;
    expect(h.type).toBe("command");
    expect(h.command).toContain("${CLAUDE_PLUGIN_ROOT}/scripts/session-start.sh");
    expect(h.timeout ?? 0).toBeGreaterThan(0);
    expect(h.timeout ?? 99).toBeLessThanOrEqual(10);
  });
  test("the script exists and is executable", () => {
    const p = join(PLUGIN_ROOT, "scripts/session-start.sh");
    expect(existsSync(p)).toBe(true);
    expect(lstatSync(p).mode & 0o111).not.toBe(0);
  });
});

describe("layout", () => {
  test("NO top-level bin/ (it makes claude.ai and the desktop Customize flow refuse the plugin)", () => {
    expect(existsSync(join(PLUGIN_ROOT, "bin"))).toBe(false);
    expect(readdirSync(PLUGIN_ROOT).map((n) => n.toLowerCase())).not.toContain("bin");
  });
  test("the CLI bundle lives in scripts/", () => {
    expect(existsSync(join(PLUGIN_ROOT, "scripts/osg.mjs"))).toBe(true);
  });
  test("only expected top-level entries, and no symlinks", () => {
    const allowed = new Set([".claude-plugin", ".mcp.json", "skills", "hooks", "scripts", "templates", "tests", "README.md", "LICENSE", "package.json", "tsconfig.json"]);
    for (const n of readdirSync(PLUGIN_ROOT)) { if (n === "node_modules") continue; expect(allowed.has(n)).toBe(true); }
    for (const f of walk(PLUGIN_ROOT)) expect(lstatSync(join(PLUGIN_ROOT, f)).isSymbolicLink()).toBe(false);
  });
  test("LICENSE and README exist", () => {
    expect(read(join(PLUGIN_ROOT, "LICENSE"))).toContain("MIT License");
    expect(read(join(PLUGIN_ROOT, "README.md"))).toContain("Manual test plan");
  });
});

describe("skills", () => {
  const dirs = readdirSync(join(PLUGIN_ROOT, "skills")).sort();
  test("exactly the ten skills", () => expect(dirs).toEqual([...SKILL_NAMES].sort()));

  const toolNames = new Set(Object.keys(MCP_TOOLS));
  const slugs = new Set<string>(DOC_SLUGS);
  const playbooks = new Set<string>(PLAYBOOKS);
  const ALLOWED_KEYS = new Set(["name", "description", "when_to_use", "argument-hint", "arguments", "disable-model-invocation", "user-invocable", "allowed-tools", "disallowed-tools", "model", "effort", "context", "agent", "hooks", "paths", "shell", "metadata"]);
  const MUTATING = ["create_game", "update_game_metadata", "request_upload", "submit_version", "withdraw_version", "unpublish_game", "rollback_version"];

  for (const name of SKILL_NAMES) {
    describe(name, () => {
      const file = join(PLUGIN_ROOT, "skills", name, "SKILL.md");
      const src = read(file);
      const fm = frontmatter(src);

      test("frontmatter: name matches the folder, description is written for auto-invocation", () => {
        expect(fm).not.toBeNull();
        expect(fm!.meta.name).toBe(name);
        expect(fm!.meta.description!.length).toBeGreaterThan(80);
        expect(fm!.meta.description!.length).toBeLessThanOrEqual(600);
        for (const k of Object.keys(fm!.meta)) expect(ALLOWED_KEYS.has(k)).toBe(true);
      });

      test("at most 500 lines", () => expect(src.split("\n").length).toBeLessThanOrEqual(500));

      test("disable-model-invocation only on osg-publish", () => {
        if (name === "osg-publish") expect(fm!.meta["disable-model-invocation"]).toBe("true");
        else expect(fm!.meta).not.toHaveProperty("disable-model-invocation");
      });

      test("allowed-tools reference existing MCP tools on the right server", () => {
        const allowed = fm!.meta["allowed-tools"] ?? "";
        for (const m of allowed.matchAll(/mcp__plugin_osg_([a-z-]+)__([a-z_]+)/g)) {
          const tool = MCP_TOOLS[m[2] as keyof typeof MCP_TOOLS];
          expect(tool, `${name}: unknown tool ${m[2]}`).toBeDefined();
          expect(String(tool.server), `${name}: ${m[2]} is on server ${tool.server}`).toBe(m[1]!);
        }
        // anything shaped like an MCP name must have matched the pattern above
        for (const tok of allowed.split(/\s+/).filter((t) => t.startsWith("mcp__"))) expect(tok).toMatch(/^mcp__plugin_osg_(osg|osg-docs)__[a-z_]+$/);
      });

      test("body mentions only real MCP tools (every backticked snake_case token is a tool name, an SDK error code or node_modules)", () => {
        for (const m of fm!.body.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)) expect(toolNames.has(m[1]!) || NON_TOOL_TOKENS.has(m[1]!), `${name}: \`${m[1]}\` is not an MCP tool`).toBe(true);
      });

      test("doc slugs, playbook names, skills and CLI commands it mentions exist", () => {
        const body = fm!.body;
        for (const m of body.matchAll(/`read_doc`(?:,| with)? slug `([^`]+)`/g)) expect(slugs.has(m[1]!), `${name}: slug ${m[1]}`).toBe(true);
        for (const m of body.matchAll(/`get_playbook`(?:,| with)? name `([^`]+)`/g)) expect(playbooks.has(m[1]!), `${name}: playbook ${m[1]}`).toBe(true);
        for (const m of body.matchAll(/`([a-z-]+)` doc\b/g)) expect(slugs.has(m[1]!), `${name}: \`${m[1]}\` doc`).toBe(true);
        for (const m of body.matchAll(/`([a-z-]+)` playbook\b/g)) expect(playbooks.has(m[1]!), `${name}: \`${m[1]}\` playbook`).toBe(true);
        for (const m of body.matchAll(/`(osg-[a-z]+)` skill\b/g)) expect(SKILL_NAMES).toContain(m[1]!);
        for (const m of body.matchAll(/\/osg:(osg-[a-z]+)/g)) expect(SKILL_NAMES).toContain(m[1]!);
        for (const m of body.matchAll(/osg\.mjs" ([a-z-]+|--[a-z]+)/g)) expect(CLI_COMMANDS, `${name}: osg.mjs ${m[1]}`).toContain(m[1]!);
      });

      test("the bundled CLI is always run through the quoted plugin root, never npx or a bare osg", () => {
        for (const line of src.split("\n")) {
          if (/npx/.test(line)) expect(line).toMatch(/never|not/i);
          if (/bun .*osg\.mjs/.test(line)) expect(line).toContain('"${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs"');
        }
      });

      test("no dangerous shell in the text (curl | sh is allowed only for the Bun installer in osg-start)", () => {
        const pipes = src.split("\n").filter((l) => /\|\s*(ba)?sh\b/.test(l));
        if (name === "osg-start") for (const l of pipes) expect(l).toContain("https://bun.sh/install");
        else expect(pipes).toEqual([]);
      });
    });
  }

  test("every doc slug and playbook is reachable from some skill or from the docs themselves", () => {
    const all = SKILL_NAMES.map((n) => read(join(PLUGIN_ROOT, "skills", n, "SKILL.md"))).join("\n");
    for (const s of ["getting-started", "design", "sdk", "dev", "multiplayer", "npcs", "scores", "rules", "publish", "assets", "manifest", "troubleshooting"]) expect(all).toContain(`\`${s}\``);
    for (const p of ["first-game", "add-multiplayer", "add-npcs", "add-leaderboard", "fix-rejection", "polish-pass", "update-game"]) {
      const inSkills = all.includes(p);
      const inDocs = ["getting-started", "design", "publish"].some((d) => read(join(PLUGIN_ROOT, "../docs/author", `${d}.md`)).includes(p));
      expect(inSkills || inDocs, p).toBe(true);
    }
  });

  test("osg-start: Bun preflight, ultracode, design before code, the email timeline", () => {
    const s = read(join(PLUGIN_ROOT, "skills/osg-start/SKILL.md"));
    expect(s).toContain("bun --version");
    expect(s).toContain("1.3");
    expect(s).toContain("/effort ultracode");
    expect(s).toContain("--effort ultracode");
    expect(s).toContain("osg-design");
    expect(s).toMatch(/10-20 minutes/);
    expect(s).toContain("init");
  });

  test("osg-design: ultracode, banned defaults, rubric, screenshots, references for feel only", () => {
    const s = read(join(PLUGIN_ROOT, "skills/osg-design/SKILL.md"));
    for (const w of ["ultracode", "Banned defaults", "purple or pink gradients", "Screenshot moment", "Rubric", "osg.mjs\" shot", "30-second", "feel"]) expect(s).toContain(w);
  });

  test("osg-rules has the pre-flight checklist", () => {
    const s = read(join(PLUGIN_ROOT, "skills/osg-rules/SKILL.md"));
    expect(s).toContain("Pre-flight checklist");
    expect(s.match(/^\d+\. /gm)!.length).toBeGreaterThanOrEqual(12);
  });

  test("osg-sdk asks about multiplayer topology before code", () => {
    expect(read(join(PLUGIN_ROOT, "skills/osg-sdk/SKILL.md"))).toMatch(/topology/);
  });

  test("osg-publish: narrow allowed-tools; nothing that changes the platform is pre-approved", () => {
    const fm = frontmatter(read(join(PLUGIN_ROOT, "skills/osg-publish/SKILL.md")))!;
    const allowed = fm.meta["allowed-tools"]!;
    for (const t of MUTATING) expect(allowed).not.toContain(t);
    expect(allowed).not.toMatch(/osg\.mjs" (submit|login)/);
    expect(allowed).not.toMatch(/Bash\(\*\)|Bash\(bun \*\)/);
    expect(allowed).not.toContain("Write");
    expect(allowed).not.toContain("Edit");
    // every Bash pattern is pinned to the bundled CLI (or the version check)
    for (const m of allowed.matchAll(/Bash\(([^)]*)\)/g)) expect(m[1] === "bun --version" || m[1]!.startsWith('bun "${CLAUDE_PLUGIN_ROOT}/scripts/osg.mjs" ')).toBe(true);
    // the body tells Claude to stop and ask, and to print the CLI message verbatim
    expect(fm.body).toContain("verbatim");
    expect(fm.body).toMatch(/10-20 minutes/);
  });

  test("no skill allows Write, Edit or unrestricted Bash", () => {
    for (const n of SKILL_NAMES) {
      const a = frontmatter(read(join(PLUGIN_ROOT, "skills", n, "SKILL.md")))!.meta["allowed-tools"] ?? "";
      expect(a).not.toMatch(/(^|\s)(Write|Edit|Bash)(\s|$)/);
    }
  });
});
