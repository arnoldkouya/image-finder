import { getJson, qs, buildAttribution } from '../util.js';

export default {
  name: 'unsplash',
  label: 'Unsplash (free stock, needs UNSPLASH_ACCESS_KEY)',
  requiresKey: 'UNSPLASH_ACCESS_KEY',
  async search(q, o, ctx) {
    const orientation = { landscape: 'landscape', portrait: 'portrait', square: 'squarish' }[o.orientation];
    const data = await getJson(
      `https://api.unsplash.com/search/photos?${qs({ query: q, per_page: Math.min(o.limit, 30), page: o.page, orientation })}`,
      { ...ctx, headers: { Authorization: `Client-ID ${ctx.keys.UNSPLASH_ACCESS_KEY}` } },
    );
    return (data.results || []).map((p) => {
      const title = p.description || p.alt_description || `Unsplash photo ${p.id}`;
      const creator = p.user?.name;
      return {
        provider: 'unsplash',
        source: 'unsplash.com',
        id: p.id,
        title,
        creator,
        url: p.urls.full,
        thumbnail: p.urls.small,
        pageUrl: p.links.html,
        width: p.width,
        height: p.height,
        license: 'Unsplash License',
        licenseUrl: 'https://unsplash.com/license',
        attribution: buildAttribution({ title, creator, license: 'Unsplash License', pageUrl: p.links.html }),
      };
    });
  },
};
