import { getJson, qs, buildAttribution } from '../util.js';

export default {
  name: 'pixabay',
  label: 'Pixabay (free stock, needs PIXABAY_API_KEY)',
  requiresKey: 'PIXABAY_API_KEY',
  async search(q, o, ctx) {
    const orientation = { landscape: 'horizontal', portrait: 'vertical' }[o.orientation];
    const data = await getJson(
      `https://pixabay.com/api/?${qs({ key: ctx.keys.PIXABAY_API_KEY, q, image_type: 'photo', per_page: Math.max(3, Math.min(o.limit, 50)), page: o.page, orientation, safesearch: 'true', min_width: o.minWidth, min_height: o.minHeight })}`,
      ctx,
    );
    return (data.hits || []).map((h) => {
      const title = h.tags;
      return {
        provider: 'pixabay',
        source: 'pixabay.com',
        id: String(h.id),
        title,
        creator: h.user,
        url: h.largeImageURL,
        thumbnail: h.webformatURL,
        pageUrl: h.pageURL,
        width: h.imageWidth,
        height: h.imageHeight,
        license: 'Pixabay License',
        licenseUrl: 'https://pixabay.com/service/license-summary/',
        attribution: buildAttribution({ title, creator: h.user, license: 'Pixabay License', pageUrl: h.pageURL }),
      };
    });
  },
};
