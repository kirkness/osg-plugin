import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const PLUGIN_ROOT = resolve(import.meta.dir, "..");
export const REPO_ROOT = resolve(PLUGIN_ROOT, "..");
export const DOCS_DIR = join(REPO_ROOT, "docs/author");

export const read = (p: string): string => readFileSync(p, "utf8");
export const readJson = (p: string): unknown => JSON.parse(read(p));

/** All files under dir (relative paths), skipping node_modules. */
export function walk(dir: string, skip: (rel: string) => boolean = () => false, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const full = join(dir, name);
    const rel = full.slice(base.length + 1);
    if (skip(rel)) continue;
    if (statSync(full).isDirectory()) out.push(...walk(full, skip, base));
    else out.push(rel);
  }
  return out;
}

/** Minimal frontmatter reader (same shape the MCP docs bundler accepts: `key: value` lines). */
export function frontmatter(src: string): { meta: Record<string, string>; body: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

/** Files whose text is shipped to authors: skills, author docs, starter project, README. */
export function publicTextFiles(): string[] {
  const files: string[] = [];
  for (const f of walk(join(PLUGIN_ROOT, "skills"))) files.push(join(PLUGIN_ROOT, "skills", f));
  for (const f of walk(join(PLUGIN_ROOT, "codex/skills"))) files.push(join(PLUGIN_ROOT, "codex/skills", f));
  for (const f of walk(join(PLUGIN_ROOT, "templates"))) files.push(join(PLUGIN_ROOT, "templates", f));
  for (const f of walk(DOCS_DIR)) files.push(join(DOCS_DIR, f));
  files.push(join(PLUGIN_ROOT, "README.md"));
  return files.filter((f) => existsSync(f));
}

/** Fenced code blocks of a markdown file: [lang, body]. */
export function fences(md: string): { lang: string; body: string }[] {
  const out: { lang: string; body: string }[] = [];
  const re = /```([a-z]*)\n([\s\S]*?)```/g;
  for (let m = re.exec(md); m; m = re.exec(md)) out.push({ lang: m[1]!, body: m[2]! });
  return out;
}
