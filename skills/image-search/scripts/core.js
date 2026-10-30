import { mkdir, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import path from 'node:path';
import openverse from './providers/openverse.js';
import wikimedia from './providers/wikimedia.js';
import nasa from './providers/nasa.js';
import pexels from './providers/pexels.js';
import unsplash from './providers/unsplash.js';
import pixabay from './providers/pixabay.js';
import { classifyLicense, UA } from './util.js';

export const PROVIDERS = [openverse, wikimedia, nasa, pexels, unsplash, pixabay];
const byName = Object.fromEntries(PROVIDERS.map((p) => [p.name, p]));

export const LICENSE_FILTERS = ['any', 'commercial', 'modifiable', 'public-domain'];
export const ORIENTATIONS = ['landscape', 'portrait', 'square'];

export function listProviders(env = process.env) {
  return PROVIDERS.map((p) => ({
    name: p.name,
    label: p.label,
    requiresKey: p.requiresKey,
    enabled: !p.requiresKey || Boolean(env[p.requiresKey]),
  }));
}

function matchesLicense(r, filter) {
  if (filter === 'any' || !filter) return true;
  const c = classifyLicense(r.license);
  if (filter === 'public-domain') return c.kind === 'public-domain';
  if (filter === 'commercial') return c.commercial;
  if (filter === 'modifiable') return c.commercial && c.derivatives;
  return true;
}

function orientationOf(r) {
  if (!r.width || !r.height) return null;
  const ratio = r.width / r.height;
  return ratio > 1.1 ? 'landscape' : ratio < 0.9 ? 'portrait' : 'square';
}

const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Search several providers in parallel, then filter, dedupe and interleave. */
export async function searchImages(opts, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const o = {
    query: String(opts.query || '').trim(),
    providers: opts.providers?.length ? opts.providers : null,
    limit: Math.min(Math.max(Number(opts.limit) || 12, 1), 50),
    page: Math.max(Number(opts.page) || 1, 1),
    license: opts.license || 'any',
    orientation: opts.orientation,
    minWidth: Number(opts.minWidth) || 0,
    minHeight: Number(opts.minHeight) || 0,
  };
  if (!o.query) throw new Error('query is required');
  if (!LICENSE_FILTERS.includes(o.license)) throw new Error(`license must be one of ${LICENSE_FILTERS.join(', ')}`);
  if (o.orientation && !ORIENTATIONS.includes(o.orientation)) throw new Error(`orientation must be one of ${ORIENTATIONS.join(', ')}`);

  const keys = env;
  const selected = (o.providers ? o.providers.map((n) => {
    if (!byName[n]) throw new Error(`unknown provider "${n}" (available: ${PROVIDERS.map((p) => p.name).join(', ')})`);
    return byName[n];
  }) : PROVIDERS);
  const errors = [];
  const active = selected.filter((p) => {
    if (p.requiresKey && !keys[p.requiresKey]) {
      if (o.providers) errors.push({ provider: p.name, error: `missing ${p.requiresKey}` });
      return false;
    }
    return true;
  });

  const ctx = { keys, fetchImpl };
  const settled = await Promise.allSettled(active.map((p) => p.search(o.query, o, ctx)));
  const lists = settled.map((s, i) => {
    if (s.status === 'rejected') {
      errors.push({ provider: active[i].name, error: s.reason?.message || String(s.reason) });
      return [];
    }
    return s.value.filter((r) => r.url && /^https?:\/\//.test(r.url));
  });

  // filter
  const filtered = lists.map((l) => l.filter((r) =>
    matchesLicense(r, o.license) &&
    (!o.minWidth || (r.width || 0) >= o.minWidth) &&
    (!o.minHeight || (r.height || 0) >= o.minHeight) &&
    (!o.orientation || !orientationOf(r) || orientationOf(r) === o.orientation)));

  // round-robin interleave + dedupe
  const seenUrl = new Set();
  const seenTitle = new Set();
  const results = [];
  for (let i = 0; results.length < o.limit; i++) {
    let any = false;
    for (const l of filtered) {
      const r = l[i];
      if (!r) continue;
      any = true;
      const tk = `${norm(r.title)}|${norm(r.creator)}`;
      if (seenUrl.has(r.url) || (norm(r.title) && seenTitle.has(tk))) continue;
      seenUrl.add(r.url);
      seenTitle.add(tk);
      const c = classifyLicense(r.license);
      results.push({ ...r, orientation: orientationOf(r), commercialUse: c.commercial, derivativesAllowed: c.derivatives });
      if (results.length >= o.limit) break;
    }
    if (!any) break;
  }
  return { query: o.query, count: results.length, providersQueried: active.map((p) => p.name), results, errors };
}

/* ---------- download / inspect ---------- */

const MAX_BYTES = 30 * 1024 * 1024;

function isPrivateIp(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
}

/** Refuse non-http(s) URLs and hosts resolving to private/loopback addresses (SSRF guard). */
export async function assertPublicUrl(raw, { resolver = lookup } = {}) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('invalid URL'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('only http(s) URLs are allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await resolver(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error('refusing to fetch private/loopback address');
  return u;
}

/** Read width/height from PNG, JPEG, GIF or WebP headers. */
export function sniffImage(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) return { format: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') return { format: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const t = buf.toString('ascii', 12, 16);
    if (t === 'VP8X') return { format: 'webp', width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
    if (t === 'VP8L') { const b = buf.readUInt32LE(21); return { format: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
    if (t === 'VP8 ') return { format: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    return { format: 'webp' };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { format: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { format: 'jpeg' };
  }
  return null;
}

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/tiff': '.tif' };

async function fetchImage(url, { fetchImpl, resolver, maxBytes = MAX_BYTES, headOnly = false }) {
  let current = await assertPublicUrl(url, { resolver });
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetchImpl(current, { headers: { 'User-Agent': UA, Accept: 'image/*' }, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = await assertPublicUrl(new URL(res.headers.get('location'), current).href, { resolver });
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/')) throw new Error(`not an image (content-type: ${type || 'unknown'})`);
    const declared = Number(res.headers.get('content-length')) || null;
    if (declared && declared > maxBytes) throw new Error(`file too large (${declared} bytes)`);
    const chunks = [];
    let total = 0;
    const limit = headOnly ? 65536 : maxBytes;
    for await (const c of res.body) {
      chunks.push(c);
      total += c.length;
      if (total > limit) { if (headOnly) break; throw new Error(`file too large (> ${maxBytes} bytes)`); }
    }
    return { type, declared, buf: Buffer.concat(chunks), finalUrl: current.href };
  }
  throw new Error('too many redirects');
}

export async function inspectImage(url, deps = {}) {
  const { fetchImpl = globalThis.fetch, resolver } = deps;
  const { type, declared, buf, finalUrl } = await fetchImage(url, { fetchImpl, resolver, headOnly: true });
  const dim = sniffImage(buf) || {};
  return { url: finalUrl, contentType: type, bytes: declared, width: dim.width, height: dim.height };
}

export async function downloadImage({ url, dir = './images', filename }, deps = {}) {
  const { fetchImpl = globalThis.fetch, resolver } = deps;
  const { type, buf, finalUrl } = await fetchImage(url, { fetchImpl, resolver });
  const dim = sniffImage(buf) || {};
  const urlExt = path.extname(new URL(finalUrl).pathname).toLowerCase();
  const ext = EXT[type] || (/^\.[a-z0-9]{2,5}$/.test(urlExt) ? urlExt : '.img');
  const base = (filename ? path.basename(filename, path.extname(filename)) : path.basename(new URL(finalUrl).pathname, urlExt) || 'image')
    .replace(/[^\w.-]+/g, '_').replace(/^\.+/, '').slice(0, 80) || 'image';
  const absDir = path.resolve(dir);
  await mkdir(absDir, { recursive: true });
  const file = path.join(absDir, base + ext);
  await writeFile(file, buf);
  return { path: file, bytes: buf.length, contentType: type, width: dim.width, height: dim.height };
}
