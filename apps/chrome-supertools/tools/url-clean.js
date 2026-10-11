/** Strip hash and all query params; keep origin + path only. */
export function cleanUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';

    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.href;
  } catch {
    return url;
  }
}
