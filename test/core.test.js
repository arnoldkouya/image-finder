import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { searchImages, sniffImage, assertPublicUrl, downloadImage, inspectImage, listProviders } from '../skills/image-search/scripts/core.js';
import { handle, TOOLS } from '../skills/image-search/scripts/mcp.js';
import { classifyLicense } from '../skills/image-search/scripts/util.js';

const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });

function fakeFetch(url) {
  const u = String(url);
  if (u.includes('openverse')) return json({ results: [
    { id: 'a', title: 'Red Fox', url: 'https://img.example/fox1.jpg', thumbnail: 't', creator: 'Ann', license: 'by', license_version: '4.0', license_url: 'https://cc/by', foreign_landing_url: 'https://p/1', width: 2000, height: 1000, source: 'flickr' },
    { id: 'b', title: 'Fox NC', url: 'https://img.example/fox2.jpg', creator: 'Bob', license: 'by-nc', license_version: '2.0', width: 800, height: 1200 },
    { id: 'c', title: 'Fox CC0', url: 'https://img.example/fox3.jpg', creator: 'Cy', license: 'cc0', license_version: '1.0', width: 1000, height: 1000 },
  ] });
  if (u.includes('wikimedia')) return json({ query: { pages: {
    1: { pageid: 1, index: 1, title: 'File:Fox.jpg', imageinfo: [{ url: 'https://img.example/fox1.jpg', thumburl: 't', descriptionurl: 'https://commons/1', width: 3000, height: 2000, mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a>Dee</a>' } } }] },
    2: { pageid: 2, index: 2, title: 'File:Doc.pdf', imageinfo: [{ url: 'https://img.example/d.pdf', mime: 'application/pdf' }] },
  } } });
  if (u.includes('nasa')) return json({ collection: { items: [{ data: [{ nasa_id: 'X1', title: 'Moon', description: 'd', center: 'JSC' }], links: [{ rel: 'preview', href: 'https://nasa/X1~thumb.jpg' }] }] } });
  if (u.includes('pexels')) return json({ photos: [{ id: 9, alt: 'Fox pexels', photographer: 'Pex', url: 'https://pexels/9', width: 4000, height: 3000, src: { original: 'https://img.example/p9.jpg', medium: 'm' } }] });
  throw new Error('unexpected ' + u);
}

test('merges providers, filters NC for commercial, dedupes by url', async () => {
  const r = await searchImages({ query: 'fox', license: 'commercial', limit: 20 }, { env: {}, fetchImpl: fakeFetch });
  const titles = r.results.map((x) => x.title);
  assert.ok(!titles.includes('Fox NC'));
  assert.equal(r.results.filter((x) => x.url === 'https://img.example/fox1.jpg').length, 1);
  assert.ok(titles.includes('Moon'));
  assert.ok(!r.results.some((x) => x.url.endsWith('.pdf')));
  assert.deepEqual(r.providersQueried, ['openverse', 'wikimedia', 'nasa']);
});

test('public-domain filter and keyed provider', async () => {
  const r = await searchImages({ query: 'fox', license: 'public-domain' }, { env: { PEXELS_API_KEY: 'k' }, fetchImpl: fakeFetch });
  assert.ok(r.results.every((x) => /cc0|public domain/i.test(x.license)));
  const p = await searchImages({ query: 'fox', providers: ['pexels'] }, { env: { PEXELS_API_KEY: 'k' }, fetchImpl: fakeFetch });
  assert.equal(p.results[0].license, 'Pexels License');
  assert.match(p.results[0].attribution, /Pex/);
});

test('size and orientation filters; provider failures are reported not thrown', async () => {
  const r = await searchImages({ query: 'fox', minWidth: 1500, orientation: 'landscape' }, { env: {}, fetchImpl: (u) => (String(u).includes('nasa') ? Promise.reject(new Error('boom')) : fakeFetch(u)) });
  assert.ok(r.results.every((x) => x.width >= 1500 && x.orientation === 'landscape'));
  assert.equal(r.errors[0].provider, 'nasa');
});

test('missing key reported only when provider explicitly requested', async () => {
  const r = await searchImages({ query: 'x', providers: ['pixabay'] }, { env: {}, fetchImpl: fakeFetch });
  assert.match(r.errors[0].error, /PIXABAY_API_KEY/);
  await assert.rejects(searchImages({ query: '' }), /query is required/);
  await assert.rejects(searchImages({ query: 'x', providers: ['nope'] }), /unknown provider/);
});

test('license classification', () => {
  assert.equal(classifyLicense('CC0 1.0').kind, 'public-domain');
  assert.equal(classifyLicense('PDM 1.0').kind, 'public-domain');
  assert.deepEqual(classifyLicense('CC BY-NC-ND 4.0'), { kind: 'cc', commercial: false, derivatives: false });
  assert.equal(classifyLicense('CC BY-SA 4.0').commercial, true);
  assert.equal(classifyLicense('Pexels License').kind, 'free-commercial');
});

test('SSRF guard', async () => {
  await assert.rejects(assertPublicUrl('file:///etc/passwd'), /http/);
  await assert.rejects(assertPublicUrl('http://127.0.0.1/x.png'), /private/);
  await assert.rejects(assertPublicUrl('http://[::1]/x.png'), /private/);
  await assert.rejects(assertPublicUrl('http://evil.test/x', { resolver: async () => [{ address: '10.0.0.5' }] }), /private/);
  await assertPublicUrl('https://ok.test/x', { resolver: async () => [{ address: '93.184.216.34' }] });
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.from([0, 0, 1, 0, 0, 0, 0, 128]), Buffer.alloc(20)]);
const publicResolver = async () => [{ address: '93.184.216.34' }];

test('sniff png and download/inspect with redirect', async () => {
  assert.deepEqual(sniffImage(PNG), { format: 'png', width: 256, height: 128 });
  const f = async (u) => (String(u).includes('/r') ? new Response(null, { status: 302, headers: { location: 'https://cdn.test/a.png' } }) : new Response(PNG, { headers: { 'content-type': 'image/png' } }));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'imgf-'));
  const out = await downloadImage({ url: 'https://x.test/r', dir, filename: '../../evil name' }, { fetchImpl: f, resolver: publicResolver });
  assert.equal(path.dirname(out.path), dir);
  assert.equal(path.basename(out.path), 'evil_name.png');
  assert.equal((await readFile(out.path)).length, PNG.length);
  assert.equal(out.width, 256);
  const info = await inspectImage('https://x.test/a.png', { fetchImpl: f, resolver: publicResolver });
  assert.equal(info.height, 128);
});

test('download rejects non-images and redirects to private hosts', async () => {
  const html = async () => new Response('<html>', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(downloadImage({ url: 'https://x.test/', dir: os.tmpdir() }, { fetchImpl: html, resolver: publicResolver }), /not an image/);
  const redir = async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } });
  await assert.rejects(downloadImage({ url: 'https://x.test/', dir: os.tmpdir() }, { fetchImpl: redir, resolver: publicResolver }), /private/);
});

test('MCP protocol', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(init.result.serverInfo.name, 'image-finder');
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), TOOLS.map((t) => t.name));
  const call = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_providers', arguments: {} } });
  assert.equal(JSON.parse(call.result.content[0].text).length, listProviders().length);
  const bad = await handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'search_images', arguments: {} } });
  assert.equal(bad.result.isError, true);
  assert.equal((await handle({ jsonrpc: '2.0', id: 5, method: 'nope' })).error.code, -32601);
});
