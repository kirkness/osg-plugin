import { describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { HOSTS, MCP_TOOLS, PLUGIN, sha256Hex } from "@osg/protocol";
import { adaptSkill, codexFiles } from "../scripts/sync-codex";
import { frontmatter, PLUGIN_ROOT, read, readJson } from "./helpers";

describe("Codex distribution", () => {
  test("generated manifests and skills are in sync with their shared sources", () => {
    for (const [path, expected] of codexFiles()) expect(read(join(PLUGIN_ROOT, path)), path).toBe(expected);
  });

  test("the Codex marketplace resolves the separate Codex manifest in this package", () => {
    const market = readJson(join(PLUGIN_ROOT, ".agents/plugins/marketplace.json")) as {
      name: string; plugins: { name: string; source: { source: string; path: string } }[];
    };
    expect(market.name).toBe(PLUGIN.name);
    expect(market.plugins).toHaveLength(1);
    expect(market.plugins[0]!.source).toEqual({ source: "local", path: "./" });
    const manifestPath = join(resolve(PLUGIN_ROOT, market.plugins[0]!.source.path), ".codex-plugin/plugin.json");
    const manifest = readJson(manifestPath) as { name: string; skills: string; mcpServers: string; hooks: unknown[]; version: string };
    const claude = readJson(join(PLUGIN_ROOT, ".claude-plugin/plugin.json")) as { version: string };
    expect(manifest.name).toBe(PLUGIN.name);
    expect(manifest.version).toBe(claude.version);
    expect(manifest.skills).toBe("./codex/skills/");
    expect(manifest.hooks).toEqual([]); // suppress Claude-only SessionStart discovery
    const mcp = readJson(join(PLUGIN_ROOT, manifest.mcpServers)) as { mcpServers: Record<string, { url: string }> };
    expect(mcp.mcpServers.osg?.url).toBe(`https://${HOSTS.mcp}/mcp`);
    expect(mcp.mcpServers["osg-docs"]?.url).toBe(`https://${HOSTS.mcp}/docs`);
  });

  test("all eleven skills are portable, resolve their installed bundle, and retain game guidance", () => {
    const names = readdirSync(join(PLUGIN_ROOT, "skills")).sort();
    expect(readdirSync(join(PLUGIN_ROOT, "codex/skills")).sort()).toEqual(names);
    expect(names).toHaveLength(11);
    expect(names).toContain("osg-pads");
    for (const name of names) {
      const source = read(join(PLUGIN_ROOT, "codex/skills", name, "SKILL.md"));
      expect(frontmatter(source)?.meta.name).toBe(name);
      expect(source).not.toMatch(/CLAUDE_PLUGIN_ROOT|\/effort|ultracode|\/osg:|\/mcp|mcp__plugin_|run_in_background|Bash\(/);
      expect(source).toContain("skill's actual file location");
      expect(source).toContain("OSG_PLUGIN_ROOT");
      expect(source).toContain("Tool prefixes differ by host");
      expect(source).toContain("never run the returned legacy Claude update command in Codex");
      expect(Object.keys(frontmatter(source)!.meta)).toEqual(["name", "description"]);
    }
    expect(read(join(PLUGIN_ROOT, "codex/skills/osg-design/SKILL.md"))).toContain("Rubric (0-3 each");
    expect(read(join(PLUGIN_ROOT, "codex/skills/osg-rules/SKILL.md"))).toContain("Pre-flight checklist");
    expect(read(join(PLUGIN_ROOT, "codex/skills/osg-dev/SKILL.md"))).toContain("persistent background process");
  });

  test("publishing stays explicit and native credentials are not copied to the CLI", () => {
    const source = read(join(PLUGIN_ROOT, "codex/skills/osg-publish/SKILL.md"));
    expect(source).toContain("Only proceed when the author explicitly requests publication");
    expect(source).toContain("no second CLI login is needed");
    expect(source).toContain("Prefer the native `osg` MCP connection");
    expect(source).not.toContain("skip to step 4");
    expect(source).toContain("## CLI-only fallback");
    expect(source).toContain("submit --yes");
    expect(source).toContain("--accept-creator-terms");
    expect(source).toContain("Do not run the native upload sequence as well");
    expect(read(join(PLUGIN_ROOT, "codex/skills/osg-start/SKILL.md"))).toContain("Do not start a separate CLI login for this native MCP workflow");
    expect(source).toContain("{ gameId, bytes, sha256 }");
    expect(source).toContain("--url -");
    expect(source).toContain("close it after writing");
    expect(source).toContain("stty -echo");
    expect(source).toContain("then send EOF");
    expect(source).toContain("verifies the returned checksum");
    expect(source).toContain("Only after it exits successfully");
    expect(source).toContain("{ uploadId }");
    expect(source).toContain("ask the author to copy a token");
    expect(read(join(PLUGIN_ROOT, "codex/skills/osg-publish/agents/openai.yaml"))).toContain("allow_implicit_invocation: false");
    // Claude's explicit publish policy is still present in its original source.
    expect(frontmatter(read(join(PLUGIN_ROOT, "skills/osg-publish/SKILL.md")))!.meta["disable-model-invocation"]).toBe("true");
  });

  test("the adapter rejects malformed source rather than shipping an unusable skill", () => {
    expect(() => adaptSkill("No frontmatter", "osg-start")).toThrow("Missing frontmatter");
  });

  test("a copied plugin works outside the monorepo, including paths with spaces", async () => {
    const dir = mkdtempSync(join(tmpdir(), "osg codex package "));
    try {
      const installed = join(dir, "plugin cache");
      const project = join(dir, "my game");
      for (const path of ["scripts", "templates", "codex", ".codex-plugin", ".mcp.json"]) cpSync(join(PLUGIN_ROOT, path), join(installed, path), { recursive: true });
      mkdirSync(project);
      const skill = join(installed, "codex/skills/osg-start/SKILL.md");
      const resolvedRoot = resolve(skill, "../../../..");
      expect(resolvedRoot).toBe(installed);
      const proc = Bun.spawn([process.execPath, join(resolvedRoot, "scripts/osg.mjs"), "init"], { cwd: project, stdout: "pipe", stderr: "pipe" });
      const [code, stdout, stderr] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
      expect(code, stdout + stderr).toBe(0);
      expect(existsSync(join(project, "osg.json"))).toBe(true);
      const instructions = readFileSync(join(project, "AGENTS.md"), "utf8");
      expect(instructions).toContain("osg-design");
      expect(instructions).toMatch(/no network/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 15000);

  test("the shipped uploader accepts a signed URL on stdin without account credentials or URL output", async () => {
    const dir = mkdtempSync(join(tmpdir(), "osg-codex-stdin-"));
    const archive = new TextEncoder().encode("test archive bytes");
    const hash = await sha256Hex(archive);
    const archivePath = join(dir, "source.zip");
    writeFileSync(archivePath, archive);
    let corruptReply = false;
    const received: { bytes: number; auth: string | null; token: string | null }[] = [];
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      const url = new URL(request.url);
      if (request.method !== "PUT" || url.pathname !== "/v1/uploads/test-slot") return new Response("unexpected request", { status: 404 });
      const bytes = new Uint8Array(await request.arrayBuffer());
      received.push({ bytes: bytes.length, auth: request.headers.get("authorization"), token: url.searchParams.get("token") });
      return Response.json({ ok: true, bytes: bytes.length, sha256: corruptReply ? "0".repeat(64) : await sha256Hex(bytes) });
    } });
    try {
      const base = `http://127.0.0.1:${server.port}`;
      // These are the exact payloads the native MCP publish sequence uses.
      expect(MCP_TOOLS.request_upload.input.safeParse({ gameId: "game-test", bytes: archive.length, sha256: hash }).success).toBe(true);
      expect(MCP_TOOLS.submit_version.input.safeParse({ uploadId: "test-slot" }).success).toBe(true);
      for (const mismatch of [false, true]) {
        corruptReply = mismatch;
        const signedUrl = `${base}/v1/uploads/test-slot?token=one-time-test-capability`;
        const command = [process.execPath, join(PLUGIN_ROOT, "scripts/osg.mjs"), "upload", archivePath, "--url", "-"];
        expect(command.join(" ")).not.toContain("one-time-test-capability");
        const child = Bun.spawn(command, {
          cwd: dir, env: { ...Bun.env, OSG_ENDPOINTS: JSON.stringify({ api: base }), OSG_CONFIG_DIR: join(dir, "empty-config") },
          stdin: "pipe", stdout: "pipe", stderr: "pipe",
        });
        child.stdin.write(signedUrl + "\n");
        child.stdin.end();
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
        expect(code).toBe(mismatch ? 1 : 0);
        expect(stdout + stderr).not.toContain(signedUrl);
        expect(stdout + stderr).not.toContain("one-time-test-capability");
        if (mismatch) expect(stderr).toContain("different bytes");
        else expect(stdout).toContain(`sha256 ${hash}`);
      }
      expect(received).toHaveLength(2);
      expect(received.every((request) => request.bytes === archive.length && request.auth === null && request.token === "one-time-test-capability")).toBe(true);
      expect(existsSync(join(dir, "empty-config"))).toBe(false);
    } finally { server.stop(true); rmSync(dir, { recursive: true, force: true }); }
  }, 15000);

});
