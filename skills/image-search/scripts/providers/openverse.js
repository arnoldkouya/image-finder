import { getJson, qs, buildAttribution } from '../util.js';

export default {
  name: 'openverse',
  label: 'Openverse (CC / public domain, 800M+ works)',
  requiresKey: null,
  async search(q, o, ctx) {
    const orient = { landscape: 'wide', portrait: 'tall', square: 'square' }[o.orientation];
    const lic = { 'public-domain': 'cc0,pdm', commercial: undefined }[o.license];
    const params = {
      q,
      page_size: Math.min(o.limit, 20),
      page: o.page,
      aspect_ratio: orient,
      license: lic,
      license_type: o.license === 'commercial' ? 'commercial' : o.license === 'modifiable' ? 'modification' : undefined,
      size: o.minWidth >= 1800 ? 'large' : undefined,
      mature: 'false',
    };
    const data = await getJson(`https://api.openverse.org/v1/images/?${qs(params)}`, ctx);
    return (data.results || []).map((r) => {
      const license = `${r.license}${r.license_version ? ' ' + r.license_version : ''}`.toUpperCase();
      return {
        provider: 'openverse',
        source: r.source || r.provider,
        id: r.id,
        title: r.title,
        creator: r.creator,
        url: r.url,
        thumbnail: r.thumbnail,
        pageUrl: r.foreign_landing_url,
        width: r.width,
        height: r.height,
        license,
        licenseUrl: r.license_url,
        attribution: r.attribution || buildAttribution({ title: r.title, creator: r.creator, license, licenseUrl: r.license_url, pageUrl: r.foreign_landing_url }),
      };
    });
  },
};
