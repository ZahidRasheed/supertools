/** @typedef {{ title: string, url: string, text: string, wordCount: number }} PageContent */

export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const DEFAULT_PROMPT =
  'Summarize the following article clearly and concisely. Start with a one-sentence overview, then structured bullet points with bold labels (e.g. Key Fact, Conclusion). Format your response as simple HTML only — use <p>, <ul>, <li>, and <strong> tags. Do not use Markdown, asterisks, or hash headings.';

export const DEFAULT_MODEL = 'gemini-2.5-flash';

/** Rough token estimate: ~4 chars per token for English text. */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url;
  }
}

export function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function cacheKeyForUrl(url) {
  return `summary:${hashString(normalizeUrl(url))}`;
}

/** @deprecated Use cacheKeyForUrl — kept for legacy entry cleanup */
export function cacheKey(url, prompt) {
  return `summary:${hashString(normalizeUrl(url) + '|' + prompt)}`;
}

export function isCacheValid(entry) {
  if (!entry?.summary || !entry?.timestamp) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export function truncateMiddle(text, maxChars) {
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.55);
  const tail = maxChars - head - 80;
  return (
    text.slice(0, head) +
    '\n\n[... middle section omitted due to length ...]\n\n' +
    text.slice(-tail)
  );
}
