import { cacheKeyForUrl, isCacheValid, normalizeUrl } from './utils.js';

/**
 * @param {string} url
 * @returns {Promise<object|null>}
 */
export async function getCachedSummaryForUrl(url) {
  const normalized = normalizeUrl(url);
  const key = cacheKeyForUrl(normalized);
  const result = await chrome.storage.local.get(key);
  const entry = result[key];

  if (isCacheValid(entry)) {
    return entry;
  }
  if (entry) {
    await chrome.storage.local.remove(key);
  }

  // Legacy entries keyed by url + prompt hash
  const all = await chrome.storage.local.get(null);
  let best = null;

  for (const [storageKey, value] of Object.entries(all)) {
    if (!storageKey.startsWith('summary:') || !isCacheValid(value)) continue;
    if (value?.url === normalized) {
      if (!best || value.timestamp > best.timestamp) {
        best = value;
      }
    }
  }

  return best;
}

/**
 * @param {string} url
 * @param {string} effectivePrompt
 * @param {{ summary: string, meta?: object }} data
 */
export async function setCachedSummary(url, effectivePrompt, data) {
  const normalized = normalizeUrl(url);
  const key = cacheKeyForUrl(normalized);

  await chrome.storage.local.set({
    [key]: {
      url: normalized,
      prompt: effectivePrompt,
      summary: data.summary,
      meta: data.meta || {},
      timestamp: Date.now(),
    },
  });
}

/** Remove expired cache entries (runs opportunistically). */
export async function pruneExpiredCache() {
  const all = await chrome.storage.local.get(null);
  const toRemove = [];

  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('summary:') && !isCacheValid(value)) {
      toRemove.push(key);
    }
  }

  if (toRemove.length) {
    await chrome.storage.local.remove(toRemove);
  }
}
