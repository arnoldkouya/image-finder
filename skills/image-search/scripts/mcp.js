#!/usr/bin/env node
// Minimal dependency-free MCP server (stdio, newline-delimited JSON-RPC 2.0).
import readline from 'node:readline';
import { searchImages, downloadImage, inspectImage, listProviders, LICENSE_FILTERS, ORIENTATIONS, PROVIDERS } from './core.js';

const SERVER_INFO = { name: 'image-finder', version: '1.0.0' };
const providerNames = PROVIDERS.map((p) => p.name);

export const TOOLS = [
  {
    name: 'search_images',
    description:
      'Search open-licensed images on the web (Openverse, Wikimedia Commons, NASA, plus Pexels/Unsplash/Pixabay when API keys are set). Returns direct image URLs, thumbnails, dimensions, license and a ready-to-paste attribution line.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to search for, e.g. "red fox in snow".' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Max results (default 12).' },
        page: { type: 'integer', minimum: 1 },
        license: { type: 'string', enum: LICENSE_FILTERS, description: 'any (default) | commercial (usable commercially) | modifiable (commercial + derivatives) | public-domain (CC0/PDM/PD only).' },
        orientation: { type: 'string', enum: ORIENTATIONS },
        minWidth: { type: 'integer', minimum: 0 },
        minHeight: { type: 'integer', minimum: 0 },
        providers: { type: 'array', items: { type: 'string', enum: providerNames }, description: 'Restrict to these providers (default: all enabled).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'download_image',
    description: 'Download an image URL (from search_images) to a local folder. Only public http(s) image URLs, max 30 MB.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        dir: { type: 'string', description: 'Destination folder (default ./images).' },
        filename: { type: 'string', description: 'Optional base file name; the extension is detected.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'inspect_image',
    description: 'Check that an image URL is reachable and return its content type, size and pixel dimensions without downloading it fully.',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
  },
  {
    name: 'list_providers',
    description: 'List image providers and whether each is enabled (API-key providers need an environment variable).',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name, args = {}) {
  switch (name) {
    case 'search_images': return searchImages(args);
    case 'download_image': return downloadImage(args);
    case 'inspect_image': return inspectImage(args.url);
    case 'list_providers': return listProviders();
    default: throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
  }
}

export async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (id === undefined) return null; // notification
  switch (method) {
    case 'initialize':
      return reply({
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: 'Use search_images to find open-licensed images; always surface the license and attribution to the user.',
      });
    case 'ping': return reply({});
    case 'tools/list': return reply({ tools: TOOLS });
    case 'tools/call':
      try {
        const data = await callTool(params?.name, params?.arguments);
        return reply({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: undefined });
      } catch (e) {
        if (e.code === -32602) return fail(-32602, e.message);
        return reply({ content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    default: return fail(-32601, `Method not found: ${method}`);
  }
}

export function serve() {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
      return;
    }
    const out = await handle(msg);
    if (out) process.stdout.write(JSON.stringify(out) + '\n');
  });
}

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
let isMain = false;
try { isMain = realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch {}
if (isMain) serve();
