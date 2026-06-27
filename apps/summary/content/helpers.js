(function initNewsReaderHelpers(global) {
  const TRACKING_EXACT = new Set([
    'fbclid', 'gclid', 'gbraid', 'wbraid', 'gclsrc', 'dclid', 'msclkid',
    'mc_cid', 'mc_eid', 'mkt_tok', 'igshid', 'ref', 'ref_src', 'ref_url',
    '_hsenc', '_hsmi', 'spm', 'ncid', 'ocid',
  ]);

  function isTrackingParam(key) {
    const lower = key.toLowerCase();
    if (TRACKING_EXACT.has(lower)) return true;
    if (lower.startsWith('utm_')) return true;
    if (lower.startsWith('pk_')) return true;
    return false;
  }

  function cleanUrl(url) {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      [...parsed.searchParams.keys()].forEach((key) => {
        if (isTrackingParam(key)) parsed.searchParams.delete(key);
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

  function getArticleTitle() {
    const og = document.querySelector('meta[property="og:title"]')?.content?.trim();
    if (og) return og;

    const tw = document.querySelector('meta[name="twitter:title"]')?.content?.trim();
    if (tw) return tw;

    for (const sel of ['article h1', 'main h1', '[role="main"] h1', 'h1']) {
      const el = document.querySelector(sel);
      const text = el?.innerText?.trim();
      if (text && text.length > 2) return text;
    }

    let title = document.title?.trim() || '';
    title = title.replace(/\s*[|\u2013\u2014-]\s*.+$/, '').trim();
    return title || 'Untitled';
  }

  global.NewsReaderHelpers = {
    cleanUrl,
    getArticleTitle,
    getPageMeta() {
      return {
        title: getArticleTitle(),
        url: cleanUrl(location.href),
      };
    },
  };
})(window);
