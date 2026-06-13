import { renderSummaryContent } from './render-summary.js';

const $ = (sel) => document.querySelector(sel);

const els = {
  pageTitle: $('#page-title'),
  promptBar: $('#prompt-bar'),
  sessionPrompt: $('#session-prompt'),
  stateEmpty: $('#state-empty'),
  stateLoading: $('#state-loading'),
  stateError: $('#state-error'),
  stateWarning: $('#state-warning'),
  stateResult: $('#state-result'),
  loadingText: $('#loading-text'),
  errorText: $('#error-text'),
  warningList: $('#warning-list'),
  warningPreview: $('#warning-preview'),
  summaryContent: $('#summary-content'),
  cacheBadge: $('#cache-badge'),
  cachedDate: $('#cached-date'),
  btnSummarize: $('#btn-summarize'),
  btnEditPrompt: $('#btn-edit-prompt'),
  btnApplyPrompt: $('#btn-apply-prompt'),
  btnCancelPrompt: $('#btn-cancel-prompt'),
  btnRefresh: $('#btn-refresh'),
  btnSettings: $('#btn-settings'),
  btnOpenSettings: $('#btn-open-settings'),
  btnRetry: $('#btn-retry'),
  btnWarningCancel: $('#btn-warning-cancel'),
  btnWarningContinue: $('#btn-warning-continue'),
  clipVaultSelect: $('#clip-vault'),
  btnClip: $('#btn-clip'),
};

let currentTab = null;
let sessionPromptOverride = '';
let isLoading = false;
let pendingSummarize = null;

function showState(name) {
  ['empty', 'loading', 'error', 'warning', 'result'].forEach((s) => {
    els[`state${capitalize(s)}`].classList.toggle('hidden', s !== name);
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function setLoading(loading, text) {
  isLoading = loading;
  els.btnSummarize.disabled = loading;
  els.btnEditPrompt.disabled = loading;
  els.btnRefresh.disabled = loading;
  if (loading) {
    els.loadingText.textContent = text || 'Reading page and summarizing…';
    showState('loading');
  }
}

/** Active tab in the window this side panel belongs to. */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function send(type, payload = {}) {
  const tab = await getActiveTab();
  return chrome.runtime.sendMessage({
    type,
    tabId: tab?.id,
    ...payload,
  });
}

async function refreshCurrentTab() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url?.startsWith('http')) {
    currentTab = null;
    els.pageTitle.textContent = 'Open a regular web page to summarize.';
    return false;
  }
  currentTab = { id: tab.id, url: tab.url, title: tab.title || '' };
  els.pageTitle.textContent = currentTab.title || currentTab.url;
  return true;
}

function renderSummary(data) {
  els.summaryContent.innerHTML = renderSummaryContent(data.summary);
  els.cacheBadge.classList.toggle('hidden', !data.cached);
  els.cachedDate.textContent = data.cached
    ? `Saved ${formatDate(data.cachedAt)}`
    : data.meta?.strategy === 'map_reduce'
      ? `Long article · ${data.meta.chunkCount} sections processed`
      : '';
  showState('result');
}

async function loadCachedSummary() {
  if (isLoading) return;

  pendingSummarize = null;
  const hasTab = await refreshCurrentTab();
  if (!hasTab) {
    showState('empty');
    return;
  }

  const res = await send('GET_CACHED_SUMMARY');

  if (res?.ok && res.cached) {
    renderSummary({ ...res, cached: true });
  } else {
    showState('empty');
  }
}

function renderWarnings(data) {
  els.warningList.innerHTML = data.warnings
    .map(
      (w) =>
        `<li class="${w.severity}"><strong>${w.title || 'Notice'}</strong>${w.message}</li>`
    )
    .join('');

  const p = data.preview;
  const methodLabel = {
    article: 'article tag',
    main: 'main tag',
    'content-class': 'content class',
    heuristic: 'best-guess block',
    body: 'full page',
    'inline-fallback': 'fallback extractor',
  };

  els.warningPreview.innerHTML = `
    <dt>Words extracted</dt><dd>${p.wordCount.toLocaleString()}</dd>
    <dt>Est. tokens</dt><dd>${p.estimatedTokens.toLocaleString()}</dd>
    <dt>Source</dt><dd>${methodLabel[p.extractionMethod] || p.extractionMethod}${p.extractionSelector ? ` (${p.extractionSelector})` : ''}</dd>
    <dt>API calls</dt><dd>${p.apiCalls}</dd>
  `;

  showState('warning');
}

async function summarize({ forceRefresh = false, sessionOverride = null, confirmed = false } = {}) {
  if (isLoading) return;

  const hasTab = await refreshCurrentTab();
  if (!hasTab) return;

  const override =
    sessionOverride !== null ? sessionOverride : sessionPromptOverride;

  const requestOptions = { forceRefresh, sessionOverride: override, confirmed };

  if (!confirmed) {
    pendingSummarize = requestOptions;
  }

  setLoading(true, forceRefresh ? 'Re-summarizing…' : 'Reading page and summarizing…');

  const res = await send('SUMMARIZE', {
    forceRefresh,
    confirmed,
    sessionPromptOverride: override || undefined,
  });

  setLoading(false);

  if (!res?.ok) {
    els.errorText.textContent = res.error;
    els.btnOpenSettings.classList.toggle('hidden', !res.needsSettings);
    showState('error');
    return;
  }

  if (res.needsConfirmation) {
    pendingSummarize = requestOptions;
    renderWarnings(res);
    return;
  }

  pendingSummarize = null;
  renderSummary(res);
}

function togglePromptBar(show) {
  els.promptBar.classList.toggle('hidden', !show);
  if (show) {
    els.sessionPrompt.value = sessionPromptOverride;
    els.sessionPrompt.focus();
  }
}

els.btnSummarize.addEventListener('click', () => summarize());
els.btnRefresh.addEventListener('click', () => summarize({ forceRefresh: true }));
els.btnRetry.addEventListener('click', () => summarize());

els.btnEditPrompt.addEventListener('click', () => togglePromptBar(true));

els.btnCancelPrompt.addEventListener('click', () => togglePromptBar(false));

els.btnApplyPrompt.addEventListener('click', () => {
  sessionPromptOverride = els.sessionPrompt.value.trim();
  togglePromptBar(false);
  summarize({ forceRefresh: true, sessionOverride: sessionPromptOverride });
});

els.btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

els.btnOpenSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

els.btnWarningCancel.addEventListener('click', () => {
  pendingSummarize = null;
  loadCachedSummary();
});

els.btnWarningContinue.addEventListener('click', () => {
  if (!pendingSummarize) return;
  const { forceRefresh, sessionOverride } = pendingSummarize;
  summarize({
    forceRefresh,
    sessionOverride,
    confirmed: true,
  });
});

async function loadClipVaults() {
  const res = await send('GET_CLIP_SETTINGS');
  const vaults = res?.clip?.vaults || [];
  const defaultId = res?.clip?.defaultVaultId || vaults[0]?.id || '';

  if (!vaults.length) {
    els.clipVaultSelect.innerHTML = '<option value="">Configure vault in Settings</option>';
    els.btnClip.disabled = true;
    return;
  }

  els.clipVaultSelect.innerHTML = vaults
    .map((v) => `<option value="${v.id}">${v.name || 'Vault'}</option>`)
    .join('');
  els.clipVaultSelect.value = defaultId;
  els.btnClip.disabled = false;
}

els.btnClip.addEventListener('click', async () => {
  const tab = await getActiveTab();
  let text = '';

  if (tab?.id) {
    try {
      const sel = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION' });
      text = sel?.text || '';
    } catch {
      // ignore
    }
  }

  if (!text.trim()) {
    els.errorText.textContent = 'Select text on the page first, then click Clip.';
    showState('error');
    return;
  }

  setLoading(true, 'Saving clip to Obsidian…');
  const res = await send('CLIP_SELECTION', {
    text,
    vaultId: els.clipVaultSelect.value,
  });
  setLoading(false);

  if (!res?.ok) {
    els.errorText.textContent = res.error || 'Clip failed';
    showState('error');
    return;
  }

  await loadCachedSummary();
});

chrome.tabs.onActivated.addListener(() => loadCachedSummary());

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete') return;
  const tab = await getActiveTab();
  if (tab?.id === tabId) loadCachedSummary();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadCachedSummary();
    loadClipVaults();
  }
});

loadClipVaults();
loadCachedSummary();
