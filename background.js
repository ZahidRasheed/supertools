import { getClipSettings, resolveVault, DEFAULT_CLIP_SETTINGS } from './lib/clip-settings.js';
import { getCachedSummaryForUrl, pruneExpiredCache, setCachedSummary } from './lib/cache.js';
import { summarizePage } from './lib/gemini.js';
import { isNativeHostAvailable, saveClipping, testVaultConnection } from './lib/obsidian-writer.js';
import { analyzePageForWarnings } from './lib/preflight.js';
import { DEFAULT_PROMPT, normalizeUrl } from './lib/utils.js';

const SETTINGS_KEY = 'settings';
const CLIP_MENU_ROOT = 'clip-obsidian-root';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(SETTINGS_KEY).then(async (data) => {
    if (!data[SETTINGS_KEY]) {
      await chrome.storage.sync.set({
        [SETTINGS_KEY]: {
          apiKey: '',
          permanentPrompt: DEFAULT_PROMPT,
          model: 'gemini-2.5-flash',
          clip: { ...DEFAULT_CLIP_SETTINGS },
        },
      });
    }
    await rebuildClipContextMenus();
  });
  pruneExpiredCache();
});

async function getSettings() {
  const data = await chrome.storage.sync.get(SETTINGS_KEY);
  const settings = data[SETTINGS_KEY] || {
    apiKey: '',
    permanentPrompt: DEFAULT_PROMPT,
    model: 'gemini-2.5-flash',
    clip: { ...DEFAULT_CLIP_SETTINGS },
  };
  settings.clip = getClipSettings(settings);
  return settings;
}

async function rebuildClipContextMenus() {
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({
    id: CLIP_MENU_ROOT,
    title: 'Clip to Obsidian',
    contexts: ['selection'],
  });

  const settings = await getSettings();
  const vaults = settings.clip.vaults || [];

  if (!vaults.length) {
    chrome.contextMenus.create({
      id: 'clip-obsidian-setup',
      parentId: CLIP_MENU_ROOT,
      title: 'Configure vaults in Settings…',
      contexts: ['selection'],
    });
    return;
  }

  vaults.forEach((vault) => {
    chrome.contextMenus.create({
      id: `clip-vault-${vault.id}`,
      parentId: CLIP_MENU_ROOT,
      title: vault.name || 'Unnamed vault',
      contexts: ['selection'],
    });
  });
}

function notifyClip(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
  });
}

async function clipSelection({ text, tab, vaultId }) {
  const settings = await getSettings();
  const vault = resolveVault(settings.clip, vaultId);

  if (!vault) {
    throw new Error('Add at least one Obsidian vault in Settings.');
  }

  if (!text?.trim()) {
    throw new Error('No text selected.');
  }

  const result = await saveClipping({
    vault,
    text,
    pageTitle: tab?.title || '',
    pageUrl: tab?.url || '',
    writeMode: settings.clip.writeMode || 'auto',
  });

  const fileLabel = result.filePath?.split('/').slice(-2).join('/') || 'daily clipping file';
  notifyClip('Clipped to Obsidian', `Saved to ${vault.name}: ${fileLabel}`);
  return result;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'clip-obsidian-setup') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (!info.menuItemId?.startsWith('clip-vault-')) return;

  const vaultId = info.menuItemId.replace('clip-vault-', '');

  try {
    await clipSelection({
      text: info.selectionText,
      tab,
      vaultId,
    });
  } catch (err) {
    notifyClip('Clip failed', err.message || 'Could not save clipping.');
  }
});

async function extractContentFromTab(tabId) {
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

/** Inline fallback when the content script is not yet attached. */
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

/**
 * Build effective prompt from permanent + optional one-time override.
 */
function buildEffectivePrompt(permanentPrompt, sessionOverride) {
  const base = (permanentPrompt || DEFAULT_PROMPT).trim();
  const override = (sessionOverride || '').trim();
  if (!override) return base;
  return `${base}\n\nAdditional instructions for this request:\n${override}`;
}

/** Resolve the tab the side panel is referring to. */
async function resolveTargetTab(message) {
  if (message.tabId) {
    try {
      return await chrome.tabs.get(message.tabId);
    } catch {
      // Tab may have closed — fall through
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab || null;
}

function tabPayload(tab) {
  if (!tab?.id || !tab.url?.startsWith('http')) return null;
  return {
    id: tab.id,
    url: tab.url,
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
      const settings = {
        ...(await getSettings()),
        ...message.settings,
      };
      if (message.settings?.clip) {
        settings.clip = {
          ...getClipSettings(await getSettings()),
          ...message.settings.clip,
        };
      }
      await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
      await rebuildClipContextMenus();
      return { ok: true, settings };
    }

    case 'CLIP_SELECTION': {
      const tab = await resolveTargetTab(message);
      const settings = await getSettings();

      let text = message.text?.trim();
      if (!text && tab?.id) {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
          text = response?.text?.trim();
        } catch {
          // ignore
        }
      }

      try {
        const result = await clipSelection({
          text,
          tab,
          vaultId: message.vaultId || settings.clip.defaultVaultId,
        });
        return { ok: true, ...result };
      } catch (err) {
        return { ok: false, error: err.message || 'Clip failed' };
      }
    }

    case 'TEST_VAULT': {
      const settings = await getSettings();
      const vault = resolveVault(settings.clip, message.vaultId);
      if (!vault) {
        return { ok: false, error: 'Vault not found.' };
      }
      try {
        const result = await testVaultConnection(vault, settings.clip.writeMode || 'auto');
        return { ok: true, ...result };
      } catch (err) {
        return { ok: false, error: err.message || 'Connection test failed' };
      }
    }

    case 'NATIVE_HOST_STATUS': {
      const result = await isNativeHostAvailable();
      return { ok: true, available: result.ok, error: result.error };
    }

    case 'GET_CLIP_SETTINGS':
      return { ok: true, clip: (await getSettings()).clip };

    case 'REBUILD_CLIP_MENUS':
      await rebuildClipContextMenus();
      return { ok: true };

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
      if (!payload) {
        return { ok: true, cached: false };
      }

      const url = normalizeUrl(payload.url);
      const cached = await getCachedSummaryForUrl(url);

      if (!cached) {
        return { ok: true, cached: false, url };
      }

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
        return {
          ok: false,
          error: 'Not enough readable content on this page.',
        };
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
