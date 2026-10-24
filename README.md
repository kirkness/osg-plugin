# Our Silly Games for Claude Code and Codex

Make a browser game with Claude Code or Codex and publish it on [Our Silly Games](https://oursilly.games). The plugin gives your coding assistant eleven skills (design, SDK, local dev, multiplayer, NPCs, scores, phones as controllers, rules, publish, assets, start), a local `osg` command, and two MCP servers (docs, and your account).

Marketplace `osg`, plugin `osg`, repository `kirkness/osg-plugin`. Source of truth for this directory: the `plugin/` folder of the Our Silly Games monorepo, copied to the public repo at release.

## Codex installation

Install from the public Git marketplace at `kirkness/osg-plugin` using the commands below.

With a current Codex CLI that supports `codex plugin add`:

```
codex plugin marketplace add kirkness/osg-plugin
codex plugin add osg@osg
```

Open an empty project folder in Codex desktop or run `codex` there. Start a fresh chat and say “Make me a game about…” or select `$osg-start`. Codex handles scaffolding and starts the local preview. Use `$osg-publish` when ready to share. In desktop you can also install from the Our Silly Games marketplace in the Plugins directory after adding the source.

Sign in through the account MCP server when Codex prompts. The docs server needs no account. Codex uses that same connection to request an upload and submit the game; the bundled CLI transfers the archive using a one-time upload URL and checks its checksum. No second account sign-in is needed. If native MCP cannot connect, the plugin can guide the CLI-only fallback, which uses its own browser login and confirms the game and creator terms before submitting. Never copy a token from one client into another.

This workflow needs local files, Bun and a browser: use Codex desktop or CLI. Ordinary browser-only ChatGPT chat cannot run this local build/preview workflow. No OpenAI API key is needed by the game plugin.

Update: `codex plugin marketplace upgrade osg`, then `codex plugin add osg@osg`, and start a new chat.

## Requirements

- **Codex** desktop/CLI with plugin support, or **Claude Code** 2.1.292 or newer: terminal, or the Code tab of the Claude desktop app. **Not supported:** claude.ai chat, Claude cloud sessions, desktop WSL sessions.
- **Bun 1.3 or newer** (the `osg` command and `osg dev` use Bun, not Node). `curl -fsSL https://bun.sh/install | bash`, or on Windows `powershell -c "irm bun.sh/install.ps1 | iex"`.
- An Our Silly Games account (13+).

## Claude Code installation

Terminal:

```
claude plugin install osg --marketplace kirkness/osg-plugin
```

Desktop app: Customize, Plugins, Add, Add marketplace, paste `kirkness/osg-plugin`; then Discover, Our Silly Games, Add; then start a Code session in a new folder. (There is no one-click install link.)

Then say "Make me a game about ..." or run `/osg:osg-start`. When you are ready to publish, Claude opens the bundled CLI’s browser sign-in if your account MCP connection is unavailable. If you already connected `osg` through `/mcp`, it can use those tools; the CLI manages its own sign-in for uploads.

Recommended for the first build and the polish pass: `/effort ultracode` (more usage; `/effort ultracode off` afterwards). A plugin cannot enable it for you.

Updates are not automatic for third-party marketplaces: `claude plugin update osg@osg`. A SessionStart hook prints one fixed line when the plugin is outdated.

## What is in here

```
.codex-plugin/plugin.json         Codex manifest: generated, separate skill directory, no hooks
.agents/plugins/marketplace.json  Codex marketplace: same osg@osg identity
codex/skills/<name>/SKILL.md       generated Codex adapters; no Claude-only commands or tools
.claude-plugin/plugin.json        name osg, version, homepage
.claude-plugin/marketplace.json   one entry, source "./" (relative, so a project's settings can auto-register it)
.mcp.json                         osg (OAuth) and osg-docs (anonymous): constant urls, no Authorization header
skills/<name>/SKILL.md            osg-start osg-design osg-sdk osg-dev osg-multiplayer osg-npcs osg-scores osg-pads osg-rules osg-publish osg-assets
hooks/hooks.json                  one SessionStart hook
scripts/session-start.sh          prints a FIXED line only when outdated; sends only the plugin version
scripts/osg.mjs                   the bundled CLI (built from packages/cli; never in a top-level bin/)
scripts/sync-cli.ts               copies the CLI bundle in (monorepo)
scripts/sync-codex.ts             generates Codex manifests + eleven adapted skills (--check in CI)
scripts/gen-limits.ts             generates docs/author/limits.md from LIMITS (monorepo)
templates/starter/                a hello-world project with .claude/settings.json that auto-registers this plugin
tests/                            plugin tests (monorepo)
```

Never add a top-level `bin/` directory: a plugin with one cannot be installed from claude.ai or the desktop Customize flow.

## Privacy and trust

- The Claude SessionStart hook sends only the plugin version, in `GET https://api.oursilly.games/v1/plugin/status?v=<version>` at session start. It prints nothing the server returns. Opt out with `OSG_NO_UPDATE_CHECK=1`.
- `osg-publish` is explicit-invocation only in both hosts. Publishing needs the author’s request; existing host approval prompts remain in force. Codex disables the Claude SessionStart hook.
- The CLI is a single committed file you can read: `scripts/osg.mjs`. It is run as `bun scripts/osg.mjs`, never through a floating `npx`.
- MCP servers use constant URLs (`https://mcp.oursilly.games/mcp`, `/docs`). Changing a URL or name forces every user to re-authenticate, so they are fixed.

## Developing the plugin (monorepo)

```
bun test plugin                       # plugin tests
bun run --cwd plugin typecheck
bun plugin/scripts/sync-codex.ts      # regenerate Codex adapter (--check to detect drift)
bun plugin/scripts/gen-limits.ts      # regenerate docs/author/limits.md (--check in CI)
bun run --filter @osg/cli build && bun plugin/scripts/sync-cli.ts   # refresh scripts/osg.mjs
claude plugin validate --strict plugin     # passes except the directory-only ICON_MISSING note (needs a brand icon, see docs/v1/gaps/plugin.md)
claude --plugin-dir plugin            # try it without installing
```

Author-facing docs live in `docs/author/` (served by the MCP docs server and linked from the skills by slug). Skills stay thin and point at `read_doc` and `get_playbook`, so content is updated by deploying the MCP Worker, not by releasing the plugin.

Release: bump `version` in `.claude-plugin/plugin.json`, then run `bun plugin/scripts/sync-codex.ts` to keep the Codex version aligned. Sync the CLI, run the tests and both host smoke checks, then tag and publish through the normal release process. Do not bump either marketplace entry separately. Deploy required sign-in changes before publishing the plugin. `PLUGIN_LATEST` and `PLUGIN_MIN` in osg-api decide when users are told they are outdated.

## Manual test plan

Needs a real Claude Code and a real Claude desktop app. Record each result (pass / fail / notes, version, OS) in the release issue.

### A. Terminal install and smoke test

1. `claude plugin validate --strict plugin` passes (Claude Code 2.1.281 or newer validates MCP entries).
2. Fresh machine or profile. `claude plugin install osg --marketplace kirkness/osg-plugin` succeeds. `/plugin` lists `osg@osg`.
3. `/mcp` shows `plugin:osg:osg` (needs authentication) and `plugin:osg:osg-docs` (connected, no auth). Tool names look like `mcp__plugin_osg_osg-docs__read_doc`.
4. Authenticate `osg` from `/mcp`. The consent page shows the client name from our allowlist and the requested permissions. Call `whoami`. (This is spike S1: the hard gate for sign-in.)
5. In an empty folder: `/osg:osg-start`. Claude runs `bun --version`, does the design brief before code, scaffolds with `osg init`, and mentions ultracode once.
6. Say "run my game". Claude starts `osg dev` in the background and replies with one sentence: the game is running and the link to open. No process ids, ports outside the link, `kill`/`pkill`/`Ctrl+C` or "Stop it any time" line. Say "run it" again: the same link, no second server. Say "stop the game": Claude runs `osg stop` and says it stopped; the link no longer loads. Say "restart it": stop, start, link again.
7. Start a new session with an old plugin version simulated (`PLUGIN_MIN` above the installed version): the one fixed update line appears; with `OSG_NO_UPDATE_CHECK=1` it does not; offline, the session starts normally and quickly.
8. `/osg:osg-publish` on a throwaway game: `create_game`, then `submit` each trigger a permission prompt. Claude cannot start `osg-publish` by itself ("publish my game" in chat must not run it unprompted).
9. Negative: remove Bun from `PATH`; `/osg:osg-start` tells the author the install line instead of failing.

### B. Desktop trust-prompt test (decides `NEXT_PUBLIC_STARTER_DOWNLOAD`)

Question: does opening the starter project in the desktop app's Code tab show the folder trust prompt and then register the marketplace and enable `osg@osg` from `.claude/settings.json`?

1. macOS, fresh desktop profile (or a new user account), Claude desktop signed in with a paid plan, plugin NOT installed anywhere.
2. Zip `templates/starter` (the web build script does this) and unzip it somewhere new.
3. Code tab, open the folder. Note: is a trust prompt shown? Accept it.
4. `/plugin`: is `osg@osg` listed and enabled without any manual install? Is the marketplace `osg` listed?
5. `/mcp`: do `osg` and `osg-docs` appear? Is there an extra per-server approval prompt for project-scope plugin servers? (Expected: yes, one.)
6. Run `/osg:osg-start`. Does the skill load and does `${CLAUDE_PLUGIN_ROOT}` resolve (the printed `osg.mjs --version` path exists)?
7. Do the `allowed-tools` patterns in `osg-publish` match (no prompt for `validate`, prompt for `submit`)? If `${CLAUDE_PLUGIN_ROOT}` is not expanded in `allowed-tools`, every command prompts: safe but noisy; note it.
8. Repeat on Windows desktop (path with spaces in the user name) and on a desktop WSL session (expected: plugins unavailable) and a Claude cloud session (expected: not working).
9. Pass criteria: steps 3-6 work with at most the trust prompt and one MCP approval. If they pass, set `NEXT_PUBLIC_STARTER_DOWNLOAD=1`. If not, leave the starter download off and keep the copy-the-marketplace-name flow.

### C. Manual desktop install (the documented route)

1. Customize, Plugins, Add, Add marketplace, paste `kirkness/osg-plugin`. Discover, Our Silly Games, Add. Confirm the plugin installs (it must not say "Can't be installed": that means a `bin/` directory slipped in).
2. Start a Code session in a new folder and run `/osg:osg-start`.
3. Confirm the Create dialog on the website matches these steps exactly.

### D. Release gate

`bun test plugin` green; `claude plugin validate --strict plugin` green; `scripts/osg.mjs` is not the placeholder (`bun plugin/scripts/sync-cli.ts --check`); the tag matches `plugin.json` version.

### E. Codex local package and release smoke test

1. From this monorepo, `codex plugin marketplace add ./plugin`, then `codex plugin add osg@osg`. These commands install into your Codex profile; use a dedicated test profile if you do not want a local installation in your normal profile. For a read-only package discovery check use `codex -c 'marketplaces.osg.source_type="local"' -c 'marketplaces.osg.source="/absolute/path/to/plugin"' plugin list --available --json`.
2. Start a fresh local project chat. Confirm the eleven Codex skills load from `codex/skills`, both MCP servers appear, and no Claude SessionStart hook runs.
3. Ask for a game: Codex checks Bun, writes the brief, scaffolds an `AGENTS.md` project and starts the playable preview without Claude commands. Test a plugin path containing spaces.
4. Authenticate the account MCP server using the host’s sign-in prompt. Call `whoami`, `get_quota` and `list_my_games`. Do not assume the server’s host-qualified name is literally `osg`; use the name shown by the MCP list.
5. Run `$osg-publish` only on a throwaway game you intend to publish. Verify local validation, archive hash and exact byte size, MCP upload slot, bundled upload checksum verification, MCP submission, review status and the final email. There should be only one account sign-in in the plugin flow. A failed upload must never submit a version.
6. Confirm an ordinary “improve my game” request cannot trigger a publish; missing Bun or missing MCP connections produce actionable setup instructions.
7. Run the public Git marketplace install after the release lands. Record the installation and real OAuth login results with the release smoke test.

Packaging and commands follow [OpenAI’s plugin packaging guide](https://developers.openai.com/plugins/build/plugins), [developer commands](https://learn.chatgpt.com/docs/developer-commands), and [skill invocation policy](https://learn.chatgpt.com/docs/build-skills).
