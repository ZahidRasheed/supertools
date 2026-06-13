(function initClipToolbar() {
  if (window.__newsReaderClipToolbar) return;
  window.__newsReaderClipToolbar = true;

  const SETTINGS_KEY = 'settings';
  const VAULT_COLORS = [
    '#5b8def', '#6dd4a0', '#f0a060', '#f07178',
    '#b48def', '#60c0f0', '#e879a8', '#85c88a',
  ];

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
    try {
      const data = await chrome.storage.sync.get(SETTINGS_KEY);
      const settings = data[SETTINGS_KEY] || {};
      const clip = settings.clip || {};
      vaults = Array.isArray(clip.vaults) ? clip.vaults : [];
      showToolbar = clip.showFloatingToolbar !== false;
    } catch {
      vaults = [];
      showToolbar = true;
    }
  }

  function ensureStyles() {
    if (document.getElementById('news-reader-clip-styles')) return;

    const style = document.createElement('style');
    style.id = 'news-reader-clip-styles';
    style.textContent = `
      #news-reader-clip-toolbar {
        position: fixed;
        display: none;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: #1a1d27;
        border: 1px solid #3a4055;
        border-radius: 10px;
        box-shadow: 0 8px 28px rgba(0,0,0,0.45);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 2147483647;
        pointer-events: auto;
      }
      #news-reader-clip-toolbar.visible { display: flex; }
      #news-reader-clip-toolbar .nr-vaults {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #news-reader-clip-toolbar .nr-vault-btn {
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 7px;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      #news-reader-clip-toolbar .nr-vault-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      #news-reader-clip-toolbar .nr-vault-btn.saving {
        opacity: 0.6;
        pointer-events: none;
      }
      #news-reader-clip-toolbar .nr-hint {
        font-size: 11px;
        color: #c4cad6;
        white-space: nowrap;
      }
      #news-reader-clip-toast {
        position: fixed;
        padding: 8px 12px;
        background: #242836;
        border: 1px solid #3a4055;
        border-radius: 8px;
        color: #e8eaef;
        font-size: 12px;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
        max-width: 260px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #news-reader-clip-toast.show { opacity: 1; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureToolbar() {
    if (toolbarEl) return;

    ensureStyles();
    toolbarEl = document.createElement('div');
    toolbarEl.id = 'news-reader-clip-toolbar';
    toolbarEl.innerHTML = `<span class="nr-vaults"></span>`;

    toastEl = document.createElement('div');
    toastEl.id = 'news-reader-clip-toast';

    const mount = document.body || document.documentElement;
    mount.appendChild(toolbarEl);
    mount.appendChild(toastEl);
  }

  function hideToolbar() {
    if (toolbarEl) toolbarEl.classList.remove('visible');
  }

  function showToast(message, x, y) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.style.left = `${Math.max(8, x)}px`;
    toastEl.style.top = `${Math.max(8, y - 36)}px`;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function renderVaultButtons() {
    const container = toolbarEl.querySelector('.nr-vaults');
    container.innerHTML = '';

    if (!vaults.length) {
      const hint = document.createElement('span');
      hint.className = 'nr-hint';
      hint.textContent = 'Add vaults in extension Settings';
      container.appendChild(hint);
      return;
    }

    vaults.forEach((vault, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nr-vault-btn';
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

  async function clipToVault(vaultId, btn) {
    const text = lastSelectionText;
    if (!text) return;

    const meta = window.NewsReaderHelpers?.getPageMeta?.() || {
      title: document.title,
      url: location.href,
    };

    btn.classList.add('saving');
    hideToolbar();

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'CLIP_SELECTION',
        text,
        vaultId,
        pageTitle: meta.title,
        pageUrl: meta.url,
      });

      const rect = btn.getBoundingClientRect();
      if (res?.ok) {
        showToast('Saved to Obsidian', rect.left, rect.top);
      } else {
        showToast(res?.error || 'Clip failed', rect.left, rect.top);
      }
    } catch (err) {
      showToast(err.message || 'Clip failed', 20, 20);
    } finally {
      btn.classList.remove('saving');
    }
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

    const node = range.commonAncestorContainer;
    const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (el?.getBoundingClientRect) {
      rect = el.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) return rect;
    }

    return null;
  }

  async function updateToolbar() {
    clearTimeout(updateTimer);

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
    toolbarEl.classList.add('visible');
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

  window.addEventListener('scroll', hideToolbar, { passive: true, capture: true });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[SETTINGS_KEY]) {
      loadSettings().then(scheduleUpdate);
    }
  });

  loadSettings();
})();
