# Image Finder – agent instructions (Codex & other AGENTS.md-aware agents)

When the user asks to find, source or download an image, photo or illustration, use the `image-finder` MCP tools
(`search_images`, `inspect_image`, `download_image`, `list_providers`). If MCP is not configured, run the CLI:

```bash
node /path/to/image-finder/skills/image-search/scripts/cli.js search "<query>" --license commercial --limit 10 --json
node /path/to/image-finder/skills/image-search/scripts/cli.js download "<url>" --dir ./images --name <name>
```

Workflow: infer the use (commercial? orientation? min size) → search with 2–3 query variants → `inspect_image` the finalists →
present 3–6 picks with title, size, license, creator, direct URL and the `attribution` line → download only when asked.

Rules: report licenses exactly as returned; call out NC / ND / SA restrictions; never describe an image as "free to use" beyond its
license; attribution is mandatory for CC BY / BY-SA; people, logos and trademarks may need extra rights.
