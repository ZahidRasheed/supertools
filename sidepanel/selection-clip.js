const VAULT_COLORS = [
  '#5b8def', '#6dd4a0', '#f0a060', '#f07178',
  '#b48def', '#60c0f0', '#e879a8', '#85c88a',
];

/**
 * Floating vault picker when text is selected inside the side panel.
 * @param {{
 *   root: HTMLElement,
 *   send: (type: string, payload?: object) => Promise<object>,
 *   getPageContext: () => { pageTitle: string, pageUrl: string },
 *   onStatus?: (message: string, isError?: boolean) => void,
 * }} options
 */
export function initSelectionClip({ root, send, getPageContext, onStatus }) {
  let vaults = [];
  let showToolbar = true;
  let toolbarEl = null;
  let toastEl = null;
  let lastSelectionText = '';
  let updateTimer = null;

  function vaultInitial(name) {
    const ch = (name || 'V').trim().charAt(0);
    return (ch || 'V').toUpperCase();
  }

  function vaultColor(index) {
    return VAULT_COLORS[index % VAULT_COLORS.length];
  }

  async function loadSettings() {
    const res = await send('GET_CLIP_SETTINGS');
    vaults = res?.clip?.vaults || [];
    showToolbar = res?.clip?.showFloatingToolbar !== false;
  }

  function ensureToolbar() {
    if (toolbarEl) return;

    toolbarEl = document.createElement('div');
    toolbarEl.id = 'panel-clip-toolbar';
    toolbarEl.className = 'panel-clip-toolbar hidden';
    toolbarEl.innerHTML = `<span class="panel-clip-vaults"></span>`;

    toastEl = document.createElement('div');
    toastEl.id = 'panel-clip-toast';
    toastEl.className = 'panel-clip-toast';

    document.body.appendChild(toolbarEl);
    document.body.appendChild(toastEl);
  }

  function hideToolbar() {
    if (toolbarEl) toolbarEl.classList.add('hidden');
  }

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function selectionInRoot() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    const node = sel.anchorNode;
    if (!node) return false;

    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(el && root.contains(el));
  }

  function getSelectionRect(sel) {
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    if (range.collapsed) return null;

    let rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return rect;

    const clientRects = range.getClientRects();
    if (clientRects.length > 0) {
      return clientRects[clientRects.length - 1];
    }

    return null;
  }

  function renderVaultButtons() {
    const container = toolbarEl.querySelector('.panel-clip-vaults');
    container.innerHTML = '';

    if (!vaults.length) {
      const hint = document.createElement('span');
      hint.className = 'panel-clip-hint';
      hint.textContent = 'Add vaults in Settings';
      container.appendChild(hint);
      return;
    }

    vaults.forEach((vault, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'panel-clip-vault-btn';
      btn.title = vault.name || 'Vault';
      btn.textContent = vaultInitial(vault.name);
      btn.style.background = vaultColor(index);
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        clipToVault(vault.id, btn);
      });
      container.appendChild(btn);
    });
  }

  function positionToolbar(rect) {
    const pad = 8;
    const vaultCount = Math.max(vaults.length, 1);
    const approxWidth = Math.max(40, 16 + vaultCount * 34);
    let top = rect.bottom + pad;
    let left = rect.left + rect.width / 2 - approxWidth / 2;

    left = Math.max(pad, Math.min(left, window.innerWidth - approxWidth - pad));
    if (top + 48 > window.innerHeight) {
      top = Math.max(pad, rect.top - 48 - pad);
    }

    toolbarEl.style.top = `${top}px`;
    toolbarEl.style.left = `${left}px`;
  }

  async function clipToVault(vaultId, btn) {
    const text = lastSelectionText;
    if (!text) return;

    const { pageTitle, pageUrl } = getPageContext();

    btn.classList.add('saving');
    hideToolbar();

    const res = await send('CLIP_SELECTION', {
      text,
      vaultId,
      pageTitle,
      pageUrl,
    });

    btn.classList.remove('saving');

    if (res?.ok) {
      showToast('Saved to Obsidian');
      onStatus?.('Saved to Obsidian', false);
    } else {
      const msg = res?.error || 'Clip failed';
      showToast(msg);
      onStatus?.(msg, true);
    }
  }

  async function updateToolbar() {
    clearTimeout(updateTimer);

    if (!selectionInRoot()) {
      hideToolbar();
      return;
    }

    await loadSettings();

    if (!showToolbar) {
      hideToolbar();
      return;
    }

    const sel = window.getSelection();
    const text = sel?.toString()?.trim() || '';

    if (!text || text.length < 2) {
      hideToolbar();
      return;
    }

    const rect = getSelectionRect(sel);
    if (!rect) {
      hideToolbar();
      return;
    }

    lastSelectionText = text;
    ensureToolbar();
    renderVaultButtons();
    positionToolbar(rect);
    toolbarEl.classList.remove('hidden');
  }

  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(updateToolbar, 30);
  }

  document.addEventListener('pointerup', scheduleUpdate, true);
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key.startsWith('Arrow')) scheduleUpdate();
  }, true);

  document.addEventListener('pointerdown', (e) => {
    if (toolbarEl?.contains(e.target)) return;
    if (!lastSelectionText) return;
    hideToolbar();
  }, true);

  root.addEventListener('scroll', hideToolbar, { passive: true });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.settings) {
      loadSettings().then(scheduleUpdate);
    }
  });

  loadSettings();

  /** @returns {string} */
  function getSelectedTextInPanel() {
    if (!selectionInRoot()) return '';
    return window.getSelection()?.toString()?.trim() || '';
  }

  return { getSelectedTextInPanel, hideToolbar, reloadVaults: loadSettings };
}
