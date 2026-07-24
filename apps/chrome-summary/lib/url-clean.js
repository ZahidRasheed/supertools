const TRACKING_EXACT = new Set([
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'gclsrc',
  'dclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'igshid',
  'ref',
  'ref_src',
  'ref_url',
  '_hsenc',
  '_hsmi',
  'spm',
  'ncid',
  'ocid',
]);

function isTrackingParam(key) {
  const lower = key.toLowerCase();
  if (TRACKING_EXACT.has(lower)) return true;
  if (lower.startsWith('utm_')) return true;
  if (lower.startsWith('pk_')) return true;
  return false;
}

/** Strip tracking query params and hash from a URL. */
export function cleanUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';

    [...parsed.searchParams.keys()].forEach((key) => {
      if (isTrackingParam(key)) {
        parsed.searchParams.delete(key);
      }
    });

    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    const out = parsed.href;
    return out.endsWith('?') ? out.slice(0, -1) : out;
  } catch {
    return url;
  }
}
