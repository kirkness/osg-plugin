#!/bin/sh
# SessionStart hook for the Our Silly Games plugin.
#   - Sends exactly one thing off the machine: this plugin's version, as ?v= on a public GET.
#   - Prints exactly one FIXED line, and only when the server says the plugin is outdated. Nothing the server returns is ever printed.
#   - Silent and successful on every failure (offline, timeout, no curl): a hook must never block or break a session.
#   - Opt out with OSG_NO_UPDATE_CHECK=1.
[ -n "$OSG_NO_UPDATE_CHECK" ] && exit 0
command -v curl >/dev/null 2>&1 || exit 0

root="${CLAUDE_PLUGIN_ROOT:-$(dirname "$0")/..}"
ver=$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$root/.claude-plugin/plugin.json" 2>/dev/null | head -n 1)
# the version goes into a URL: accept digits and dots only
printf '%s' "$ver" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || exit 0

body=$(curl -fsS --max-time 3 "https://api.oursilly.games/v1/plugin/status?v=$ver" 2>/dev/null) || exit 0
if printf '%s' "$body" | grep -Eq '"outdated"[[:space:]]*:[[:space:]]*true'; then
  printf '%s\n' 'Our Silly Games plugin update available. Tell the author to run: claude plugin update osg@osg (run "claude update" first if that fails).'
fi
exit 0
