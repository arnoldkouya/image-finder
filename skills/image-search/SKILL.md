---
name: image-search
description: Search the web for open-licensed images (Creative Commons, public domain, free stock) and get license + attribution. Use when the user asks to find, source, or download a photo/image/illustration, or needs a visual for a page, slide, article or design.
---

# Image search

Use the `image-finder` MCP tools (`search_images`, `inspect_image`, `download_image`, `list_providers`).
If the MCP server is not available, use the bundled CLI (path relative to this skill folder): `node scripts/cli.js search "<query>" --license commercial --limit 10 --json`, `node scripts/cli.js download <url> --dir ./images`.

## Recipe
1. `search_images` with `query`, plus `license` (`commercial` default, `public-domain` when no credit wanted, `modifiable` when editing), `orientation`, `minWidth`.
2. Run 2–3 query variants; merge the best.
3. `inspect_image` the finalists (live URL, real dimensions).
4. Show title, size, license, creator, direct URL and the `attribution` line.
5. `download_image` only on request (`dir` default `./images`).

## Always
- Surface the license and attribution; state NC/ND/SA limits.
- Keys for extra providers: `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `PIXABAY_API_KEY`.
