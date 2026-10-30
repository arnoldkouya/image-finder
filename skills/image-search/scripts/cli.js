#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { searchImages, downloadImage, inspectImage, listProviders } from './core.js';

const HELP = `image-finder – open-source image search

Usage:
  image-finder search <query> [--limit 12] [--license any|commercial|modifiable|public-domain]
                      [--orientation landscape|portrait|square] [--min-width N] [--min-height N]
                      [--providers openverse,wikimedia,nasa] [--json]
  image-finder download <url> [--dir ./images] [--name file]
  image-finder inspect <url>
  image-finder providers
  image-finder mcp                 start the MCP server (stdio)

API keys (optional): PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, PIXABAY_API_KEY`;

const { values: v, positionals: [cmd, ...rest] } = parseArgs({
  allowPositionals: true,
  options: {
    limit: { type: 'string' }, license: { type: 'string' }, orientation: { type: 'string' },
    'min-width': { type: 'string' }, 'min-height': { type: 'string' }, providers: { type: 'string' },
    page: { type: 'string' }, dir: { type: 'string' }, name: { type: 'string' },
    json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  },
});

try {
  if (!cmd || v.help || cmd === 'help') console.log(HELP);
  else if (cmd === 'mcp') (await import('./mcp.js')).serve();
  else if (cmd === 'providers') console.table(listProviders());
  else if (cmd === 'search') {
    const out = await searchImages({
      query: rest.join(' '), limit: v.limit, page: v.page, license: v.license, orientation: v.orientation,
      minWidth: v['min-width'], minHeight: v['min-height'], providers: v.providers?.split(',').filter(Boolean),
    });
    if (v.json) console.log(JSON.stringify(out, null, 2));
    else {
      out.results.forEach((r, i) => console.log(`${i + 1}. [${r.provider}] ${r.title || '(untitled)'}\n   ${r.width || '?'}x${r.height || '?'} · ${r.license}\n   ${r.url}\n   ${r.attribution}\n`));
      out.errors.forEach((e) => console.error(`! ${e.provider}: ${e.error}`));
    }
  } else if (cmd === 'download') console.log(JSON.stringify(await downloadImage({ url: rest[0], dir: v.dir, filename: v.name }), null, 2));
  else if (cmd === 'inspect') console.log(JSON.stringify(await inspectImage(rest[0]), null, 2));
  else { console.error(`unknown command: ${cmd}\n\n${HELP}`); process.exitCode = 2; }
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exitCode = 1;
}
