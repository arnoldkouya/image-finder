import { getJson, qs, stripHtml, buildAttribution } from '../util.js';

export default {
  name: 'wikimedia',
  label: 'Wikimedia Commons (free media)',
  requiresKey: null,
  async search(q, o, ctx) {
    const params = {
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: 6,
      gsrsearch: `${q} filetype:bitmap|drawing`,
      gsrlimit: Math.min(o.limit, 30),
      gsroffset: (o.page - 1) * Math.min(o.limit, 30),
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: 400,
      iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription|ObjectName',
    };
    const data = await getJson(`https://commons.wikimedia.org/w/api.php?${qs(params)}`, ctx);
    const pages = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
    return pages
      .map((p) => {
        const ii = p.imageinfo?.[0];
        if (!ii || !/^image\//.test(ii.mime || '')) return null;
        const md = ii.extmetadata || {};
        const license = md.LicenseShortName?.value || 'Unknown';
        const title = stripHtml(md.ObjectName?.value) || p.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, '');
        const creator = stripHtml(md.Artist?.value);
        const licenseUrl = md.LicenseUrl?.value;
        return {
          provider: 'wikimedia',
          source: 'commons.wikimedia.org',
          id: String(p.pageid),
          title,
          creator,
          url: ii.url,
          thumbnail: ii.thumburl,
          pageUrl: ii.descriptionurl,
          width: ii.width,
          height: ii.height,
          description: stripHtml(md.ImageDescription?.value).slice(0, 300),
          license,
          licenseUrl,
          attribution: buildAttribution({ title, creator, license, licenseUrl, pageUrl: ii.descriptionurl }),
        };
      })
      .filter(Boolean);
  },
};
