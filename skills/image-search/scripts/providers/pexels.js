import { getJson, qs, buildAttribution } from '../util.js';

export default {
  name: 'pexels',
  label: 'Pexels (free stock, needs PEXELS_API_KEY)',
  requiresKey: 'PEXELS_API_KEY',
  async search(q, o, ctx) {
    const data = await getJson(
      `https://api.pexels.com/v1/search?${qs({ query: q, per_page: Math.min(o.limit, 40), page: o.page, orientation: o.orientation })}`,
      { ...ctx, headers: { Authorization: ctx.keys.PEXELS_API_KEY } },
    );
    return (data.photos || []).map((p) => ({
      provider: 'pexels',
      source: 'pexels.com',
      id: String(p.id),
      title: p.alt || `Pexels photo ${p.id}`,
      creator: p.photographer,
      url: p.src.original,
      thumbnail: p.src.medium,
      pageUrl: p.url,
      width: p.width,
      height: p.height,
      license: 'Pexels License',
      licenseUrl: 'https://www.pexels.com/license/',
      attribution: buildAttribution({ title: p.alt, creator: p.photographer, license: 'Pexels License', pageUrl: p.url }),
    }));
  },
};
