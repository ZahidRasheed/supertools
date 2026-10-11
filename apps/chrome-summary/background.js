import { cleanUrl } from './lib/url-clean.js';
import { ensureContentScripts } from './lib/content-scripts.js';
import { getCachedSummaryForUrl, pruneExpiredCache, setCachedSummary } from './lib/cache.js';
import { summarizePage } from './lib/gemini.js';
import { analyzePageForWarnings } from './lib/preflight.js';
import { DEFAULT_PROMPT, DEFAULT_UI, normalizeUrl } from './lib/utils.js';

const SETTINGS_KEY = 'settings';
const API_KEY_KEY = 'apiKey';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(SETTINGS_KEY).then(async (data) => {
    if (!data[SETTINGS_KEY]) {
      await chrome.storage.sync.set({
        [SETTINGS_KEY]: {
          permanentPrompt: DEFAULT_PROMPT,
          model: 'gemini-2.5-flash',
          ui: { ...DEFAULT_UI },
        },
      });
    }
  });
  pruneExpiredCache();
});

/**
 * Non-secret settings sync across devices; apiKey stays in local storage only.
 * Migrates a legacy sync apiKey into local on first read.
 */
async function getSettings() {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(SETTINGS_KEY),
    chrome.storage.local.get(API_KEY_KEY),
  ]);

  const synced = syncData[SETTINGS_KEY] || {};
  let apiKey = typeof localData[API_KEY_KEY] === 'string' ? localData[API_KEY_KEY] : '';

  if (!apiKey && typeof synced.apiKey === 'string' && synced.apiKey) {
    apiKey = synced.apiKey;
    await chrome.storage.local.set({ [API_KEY_KEY]: apiKey });
    const { apiKey: _drop, ...rest } = synced;
    await chrome.storage.sync.set({ [SETTINGS_KEY]: rest });
  }

  return {
    apiKey,
    permanentPrompt: synced.permanentPrompt || DEFAULT_PROMPT,
    model: synced.model || 'gemini-2.5-flash',
    ui: { ...DEFAULT_UI, ...(synced.ui || {}) },
  };
}

async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  if (partial?.ui) {
    next.ui = { ...current.ui, ...partial.ui };
  }

  const { apiKey, permanentPrompt, model, ui } = next;
  await Promise.all([
    chrome.storage.local.set({ [API_KEY_KEY]: apiKey || '' }),
    chrome.storage.sync.set({
      [SETTINGS_KEY]: { permanentPrompt, model, ui },
    }),
  ]);
  return next;
}

async function extractContentFromTab(tabId) {
  const injected = await ensureContentScripts(tabId);
  if (!injected) {
    throw new Error('Could not read page content. Try refreshing the tab.');
  }

  const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
  if (response?.ok) return response.content;
  throw new Error(response?.error || 'Could not read page content. Try refreshing the tab.');
}

function buildEffectivePrompt(permanentPrompt, sessionOverride) {
  const base = (permanentPrompt || DEFAULT_PROMPT).trim();
  const override = (sessionOverride || '').trim();
  if (!override) return base;
  return `${base}\n\nAdditional instructions for this request:\n${override}`;
}

async function resolveTargetTab(message) {
  if (message.tabId) {
    try {
      return await chrome.tabs.get(message.tabId);
    } catch {
      // Tab may have closed
    }
  }
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

function tabPayload(tab) {
  if (!tab?.id || !tab.url?.startsWith('http')) return null;
  return {
    id: tab.id,
    url: cleanUrl(tab.url),
    title: tab.title || '',
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    sendResponse({ ok: false, error: err.message || 'Unknown error' });
  });
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_SETTINGS':
      return { ok: true, settings: await getSettings() };

    case 'SAVE_SETTINGS':
      return { ok: true, settings: await saveSettings(message.settings || {}) };

    case 'ENSURE_CONTENT_SCRIPTS': {
      const tab = await resolveTargetTab(message);
      if (!tab?.id) return { ok: false, error: 'No active tab.' };
      const injected = await ensureContentScripts(tab.id);
      return { ok: true, injected };
    }

    case 'GET_TAB_INFO': {
      const tab = await resolveTargetTab(message);
      const payload = tabPayload(tab);
      if (!payload) {
        return { ok: false, error: 'Open a regular web page to summarize.' };
      }
      return { ok: true, tab: payload };
    }

    case 'GET_CACHED_SUMMARY': {
      const tab = await resolveTargetTab(message);
      const payload = tabPayload(tab);
      if (!payload) return { ok: true, cached: false };

      const url = normalizeUrl(payload.url);
      const cached = await getCachedSummaryForUrl(url);
      if (!cached) return { ok: true, cached: false, url };

      return {
        ok: true,
        cached: true,
        summary: cached.summary,
        cachedAt: cached.timestamp,
        meta: cached.meta,
        url,
      };
    }

    case 'SUMMARIZE': {
      const settings = await getSettings();
      if (!settings.apiKey?.trim()) {
        return {
          ok: false,
          error: 'Add your Gemini API key in Settings first.',
          needsSettings: true,
        };
      }

      const tab = await resolveTargetTab(message);
      const payload = tabPayload(tab);
      if (!payload) {
        return { ok: false, error: 'Open a regular web page to summarize.' };
      }

      const effectivePrompt = buildEffectivePrompt(
        settings.permanentPrompt,
        message.sessionPromptOverride
      );
      const url = normalizeUrl(payload.url);
      const forceRefresh = Boolean(message.forceRefresh);

      if (!forceRefresh) {
        const cached = await getCachedSummaryForUrl(url);
        if (cached) {
          return {
            ok: true,
            summary: cached.summary,
            cached: true,
            cachedAt: cached.timestamp,
            meta: cached.meta,
            url,
            effectivePrompt,
          };
        }
      }

      const page = await extractContentFromTab(payload.id);
      if (!page.text?.trim() || page.wordCount < 10) {
        return { ok: false, error: 'Not enough readable content on this page.' };
      }

      const analysis = analyzePageForWarnings({ ...page, url });

      if (!message.confirmed && analysis.needsConfirmation) {
        return {
          ok: true,
          needsConfirmation: true,
          warnings: analysis.warnings,
          preview: analysis.preview,
          url,
        };
      }

      const { summary, meta } = await summarizePage({
        apiKey: settings.apiKey.trim(),
        model: settings.model || 'gemini-2.5-flash',
        userPrompt: effectivePrompt,
        page: { ...page, url },
      });

      await setCachedSummary(url, effectivePrompt, { summary, meta });

      return {
        ok: true,
        summary,
        cached: false,
        meta: { ...meta, ...analysis.preview },
        url,
        effectivePrompt,
      };
    }

    case 'CLEAR_CACHE_FOR_URL': {
      const url = normalizeUrl(message.url);
      const all = await chrome.storage.local.get(null);
      const toRemove = Object.entries(all)
        .filter(([k, v]) => k.startsWith('summary:') && v?.url === url)
        .map(([k]) => k);
      if (toRemove.length) await chrome.storage.local.remove(toRemove);
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unknown message: ${message.type}` };
  }
}
