#!/usr/bin/env bash
# Install image-finder into Claude Code. Usage: scripts/install-claude.sh [--plugin|--mcp]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:---plugin}" in
  --plugin)  # full agent + skill + command + MCP server
    claude plugin marketplace add "$ROOT"
    claude plugin install image-finder@image-finder ;;
  --mcp)     # MCP server only
    claude mcp add --scope user image-finder -- node "$ROOT/skills/image-search/scripts/mcp.js" ;;
  *) echo "usage: $0 [--plugin|--mcp]" >&2; exit 2 ;;
esac
echo "Done. Restart Claude Code, then ask: \"find a CC0 photo of a red fox\"."
