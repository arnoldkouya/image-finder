#!/usr/bin/env bash
# Install image-finder into the Codex CLI (MCP server + AGENTS.md guidance).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if command -v codex >/dev/null 2>&1 && codex mcp add --help >/dev/null 2>&1; then
  codex mcp add image-finder -- node "$ROOT/skills/image-search/scripts/mcp.js"
else
  CFG="${CODEX_HOME:-$HOME/.codex}/config.toml"
  mkdir -p "$(dirname "$CFG")"
  grep -q '^\[mcp_servers.image-finder\]' "$CFG" 2>/dev/null || \
    printf '\n[mcp_servers.image-finder]\ncommand = "node"\nargs = ["%s/skills/image-search/scripts/mcp.js"]\n' "$ROOT" >> "$CFG"
fi
# Global guidance so Codex knows when/how to use the tools
AG="${CODEX_HOME:-$HOME/.codex}/AGENTS.md"
mkdir -p "$(dirname "$AG")"
grep -q 'Image Finder' "$AG" 2>/dev/null || { echo; sed "s#/path/to/image-finder#$ROOT#g" "$ROOT/AGENTS.md"; } >> "$AG"
echo "Done. Restart Codex, then ask: \"find a CC0 photo of a red fox\"."
