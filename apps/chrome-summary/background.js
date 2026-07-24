import { cleanUrl } from './lib/url-clean.js';
import { ensureContentScripts } from './lib/content-scripts.js';
import { getCachedSummaryForUrl, pruneExpiredCache, setCachedSummary } from './lib/cache.js';
import { summarizePage } from './lib/gemini.js';
import { analyzePageForWarnings } from './lib/preflight.js';
import { DEFAULT_PROMPT, DEFAULT_UI, normalizeUrl } from './lib/utils.js';

const SETTINGS_KEY = 'settings';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
    ensureContentScripts(tabId);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(tabs.map((tab) => ensureContentScripts(tab.id)));
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(SETTINGS_KEY).then(async (data) => {
    if (!data[SETTINGS_KEY]) {
      await chrome.storage.sync.set({
        [SETTINGS_KEY]: {
          apiKey: '',
          permanentPrompt: DEFAULT_PROMPT,
          model: 'gemini-2.5-flash',
          ui: { ...DEFAULT_UI },
        },
      });
    }

    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    await Promise.all(tabs.map((tab) => ensureContentScripts(tab.id)));
  });
  pruneExpiredCache();
});

async function getSettings() {
  const data = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings = data[SETTINGS_KEY] || {
    apiKey: '',
    permanentPrompt: DEFAULT_PROMPT,
    model: 'gemini-2.5-flash',
    ui: { ...DEFAULT_UI },
  };
  settings.ui = { ...DEFAULT_UI, ...(settings.ui || {}) };
  return settings;
}

async function extractContentFromTab(tabId) {
  await ensureContentScripts(tabId);

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'EXTRACT_CONTENT' });
    if (response?.ok) return response.content;
    if (response?.error) throw new Error(response.error);
  } catch (err) {
    if (err.message && !err.message.includes('Receiving end does not exist')) {
      throw err;
    }
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: extractPageContentInline,
  });

  if (!result?.result?.text?.trim()) {
    throw new Error('Could not read page content. Try refreshing the tab.');
  }
  return result.result;
}

function extractPageContentInline() {
  const noise = [
    'script', 'style', 'noscript', 'nav', 'footer', 'header', 'aside',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  ];
  const mainSelectors = ['article', '[role="main"]', 'main', '.article-body', '.post-content', '.entry-content'];

  let root = null;
  let extraction = { method: 'inline-fallback', selector: null, foundSemanticTag: false };

  for (const sel of mainSelectors) {
    const el = document.querySelector(sel);
    if (el && (el.innerText || '').trim().length > 200) {
      root = el;
      extraction = {
        method: sel === 'article' ? 'article' : sel === 'main' || sel === '[role="main"]' ? 'main' : 'content-class',
        selector: sel,
        foundSemanticTag: true,
      };
      break;
    }
  }

  if (!root) {
    root = document.body;
    extraction = { method: 'body', selector: 'body', foundSemanticTag: false };
  }

  const clone = root.cloneNode(true);
  noise.forEach((sel) => clone.querySelectorAll(sel).forEach((el) => el.remove()));
  const text = (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    title: document.title || '',
    url: location.href,
    text,
    wordCount,
    extraction,
  };
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

    case 'SAVE_SETTINGS': {
      const current = await getSettings();
      const settings = { ...current, ...message.settings };
      if (message.settings?.ui) {
        settings.ui = { ...current.ui, ...message.settings.ui };
      }
      await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
      return { ok: true, settings };
    }

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
        .filter(([, v]) => v?.url === url)
        .map(([k]) => k);
      if (toRemove.length) await chrome.storage.local.remove(toRemove);
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unknown message: ${message.type}` };
  }
}
