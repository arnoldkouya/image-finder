export const UA = 'image-finder-agent/1.0 (+https://github.com/arnoldkouya/image-finder)';

export async function getJson(url, { headers = {}, timeoutMs = 12000, fetchImpl = globalThis.fetch } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
    return await res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`timeout after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export function stripHtml(s = '') {
  return String(s)
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function qs(params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  return u.toString();
}

/** Build a ready-to-paste credit line. */
export function buildAttribution({ title, creator, license, licenseUrl, pageUrl, provider }) {
  const parts = [];
  parts.push(title ? `"${title}"` : 'Image');
  if (creator) parts.push(`by ${creator}`);
  if (license) parts.push(`(${license}${licenseUrl ? `, ${licenseUrl}` : ''})`);
  if (pageUrl) parts.push(`– ${pageUrl}`);
  else if (provider) parts.push(`– via ${provider}`);
  return parts.join(' ');
}

/**
 * Classify a license string into: public-domain | cc | free-commercial | unknown
 * "commercial" below means usable commercially.
 */
export function classifyLicense(license = '') {
  const l = license.toLowerCase();
  if (/(^|\b)(cc0|pdm|public domain|pd\b|publicdomain)/.test(l)) return { kind: 'public-domain', commercial: true, derivatives: true };
  if (/pexels license|unsplash license|pixabay (content )?license/.test(l)) return { kind: 'free-commercial', commercial: true, derivatives: true };
  if (/\bcc\b|creative commons|^by(-|$)/.test(l) || /^(by|cc-by)/.test(l)) {
    return { kind: 'cc', commercial: !/nc/.test(l), derivatives: !/nd/.test(l) };
  }
  return { kind: 'unknown', commercial: false, derivatives: false };
}
