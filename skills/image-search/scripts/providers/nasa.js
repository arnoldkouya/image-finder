import { getJson, qs, stripHtml, buildAttribution } from '../util.js';

export default {
  name: 'nasa',
  label: 'NASA Image and Video Library (public domain)',
  requiresKey: null,
  async search(q, o, ctx) {
    const data = await getJson(`https://images-api.nasa.gov/search?${qs({ q, media_type: 'image', page: o.page, page_size: Math.min(o.limit, 50) })}`, ctx);
    return (data.collection?.items || []).map((it) => {
      const d = it.data?.[0] || {};
      const thumb = it.links?.find((l) => l.rel === 'preview')?.href || it.links?.[0]?.href;
      const url = thumb ? thumb.replace('~thumb.', '~large.') : undefined;
      const creator = d.photographer || d.secondary_creator || d.center || 'NASA';
      const pageUrl = `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`;
      return {
        provider: 'nasa',
        source: 'images.nasa.gov',
        id: d.nasa_id,
        title: d.title,
        creator,
        url,
        thumbnail: thumb,
        pageUrl,
        description: stripHtml(d.description).slice(0, 300),
        license: 'Public domain (NASA)',
        licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
        attribution: buildAttribution({ title: d.title, creator, license: 'Public domain (NASA)', pageUrl }),
      };
    }).filter((r) => r.url);
  },
};
