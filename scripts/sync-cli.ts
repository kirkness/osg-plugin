/**
 * Copies the built CLI bundle into the plugin: packages/cli/dist/osg.mjs -> plugin/scripts/osg.mjs.
 * The bundle is a committed artifact (the plugin repo has no build step), and it must NEVER live in a top-level `bin/`.
 *
 *   bun plugin/scripts/sync-cli.ts            copy (after `bun run --filter @osg/cli build`)
 *   bun plugin/scripts/sync-cli.ts --check    exit 1 if plugin/scripts/osg.mjs is a placeholder or differs from the built bundle
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { $ } from "bun";

const PLACEHOLDER_MARKER = "OSG_PLACEHOLDER";
const HERE = import.meta.dir;
export const DEFAULT_SRC = resolve(HERE, "../../packages/cli/dist/osg.mjs");
export const DEFAULT_DEST = resolve(HERE, "osg.mjs");

export interface SyncResult { ok: boolean; message: string }

/** Refuses empty files, placeholders, private keys and bundles that cannot report a version under Bun. Pure apart from running `bun <file> --version`. */
export async function syncCli(src = DEFAULT_SRC, dest = DEFAULT_DEST): Promise<SyncResult> {
  if (!existsSync(src)) return { ok: false, message: `missing ${src}: build it first with \`bun run --filter @osg/cli build\`` };
  const text = readFileSync(src, "utf8");
  if (text.length < 200) return { ok: false, message: `${src} is suspiciously small (${text.length} bytes)` };
  if (text.includes(PLACEHOLDER_MARKER)) return { ok: false, message: `${src} is still the placeholder` };
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) return { ok: false, message: `${src} contains a private key; refusing to copy` };
  const probe = await $`bun ${src} --version`.quiet().nothrow();
  if (probe.exitCode !== 0 || probe.stdout.toString().trim() === "") return { ok: false, message: `\`bun ${src} --version\` failed (exit ${probe.exitCode})` };
  const tmp = join(resolve(dest, ".."), `.osg.mjs.${process.pid}.tmp`);
  writeFileSync(tmp, text, { mode: 0o644 });
  renameSync(tmp, dest);
  return { ok: true, message: `copied ${src} -> ${dest} (version ${probe.stdout.toString().trim()})` };
}

/** True when dest is the committed placeholder. */
export const isPlaceholder = (dest = DEFAULT_DEST): boolean => !existsSync(dest) || readFileSync(dest, "utf8").includes(PLACEHOLDER_MARKER);

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    if (isPlaceholder()) { console.error("plugin/scripts/osg.mjs is a placeholder: run `bun plugin/scripts/sync-cli.ts`"); process.exit(1); }
    if (existsSync(DEFAULT_SRC) && readFileSync(DEFAULT_SRC, "utf8") !== readFileSync(DEFAULT_DEST, "utf8")) { console.error("plugin/scripts/osg.mjs differs from packages/cli/dist/osg.mjs: run `bun plugin/scripts/sync-cli.ts`"); process.exit(1); }
    console.log("plugin/scripts/osg.mjs is in sync");
  } else {
    const r = await syncCli();
    (r.ok ? console.log : console.error)(r.message);
    process.exit(r.ok ? 0 : 1);
  }
}
