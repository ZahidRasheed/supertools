import { createVaultId } from '../lib/clip-settings.js';
import { buildSettingsExport, downloadSettingsExport } from '../lib/settings-export.js';

const form = document.getElementById('settings-form');
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model');
const permanentPromptInput = document.getElementById('permanent-prompt');
const toggleKeyBtn = document.getElementById('toggle-key');
const clearCacheBtn = document.getElementById('clear-cache');
const saveStatus = document.getElementById('save-status');
const clipWriteModeSelect = document.getElementById('clip-write-mode');
const defaultVaultSelect = document.getElementById('default-vault');
const vaultListEl = document.getElementById('vault-list');
const addVaultBtn = document.getElementById('add-vault');
const testVaultBtn = document.getElementById('test-vault');
const nativeHostStatusEl = document.getElementById('native-host-status');
const extensionIdEl = document.getElementById('extension-id');
const installCommandEl = document.getElementById('install-command');
const fontSizeInput = document.getElementById('font-size');
const fontSizeLabel = document.getElementById('font-size-label');
const showFloatingToolbarInput = document.getElementById('show-floating-toolbar');
const exportSettingsBtn = document.getElementById('export-settings');

const EXT_ID = chrome.runtime.id;
extensionIdEl.textContent = EXT_ID;
installCommandEl.textContent = `cd native-host && ./install.sh ${EXT_ID}`;

/** @type {{ clip: object }} */
let state = { clip: { writeMode: 'auto', defaultVaultId: '', vaults: [] } };

function vaultTemplate(vault) {
  const id = vault.id;
  return `
    <div class="vault-item" data-vault-id="${id}">
      <div class="vault-item-header">
        <h3>${vault.name || 'Vault'}</h3>
        <button type="button" class="btn ghost remove-vault" data-id="${id}">Remove</button>
      </div>
      <label>Name</label>
      <input type="text" class="vault-name" data-id="${id}" value="${escapeAttr(vault.name)}" placeholder="Second Brain" />
      <label>Vault folder path (for native write)</label>
      <input type="text" class="vault-path" data-id="${id}" value="${escapeAttr(vault.path)}" placeholder="/Users/you/Documents/Obsidian/Second Brain" />
      <label>Clippings folder (inside vault)</label>
      <input type="text" class="vault-folder" data-id="${id}" value="${escapeAttr(vault.clippingsFolder || 'Clippings')}" placeholder="Clippings" />
      <label>REST API URL (optional)</label>
      <input type="text" class="vault-api-url" data-id="${id}" value="${escapeAttr(vault.restApiUrl || 'https://127.0.0.1:27124')}" placeholder="https://127.0.0.1:27124" />
      <label>REST API key (optional)</label>
      <input type="password" class="vault-api-key" data-id="${id}" value="${escapeAttr(vault.restApiKey || '')}" placeholder="From Obsidian Local REST API plugin" />
    </div>
  `;
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function renderVaults() {
  const vaults = state.clip.vaults || [];
  vaultListEl.innerHTML = vaults.map(vaultTemplate).join('');

  defaultVaultSelect.innerHTML = vaults.length
    ? vaults.map((v) => `<option value="${v.id}">${v.name || 'Unnamed vault'}</option>`).join('')
    : '<option value="">— Add a vault first —</option>';

  defaultVaultSelect.value = state.clip.defaultVaultId || vaults[0]?.id || '';
}

function readVaultsFromDom() {
  return [...vaultListEl.querySelectorAll('.vault-item')].map((item) => {
    const id = item.dataset.vaultId;
    return {
      id,
      name: item.querySelector(`.vault-name[data-id="${id}"]`)?.value.trim() || '',
      path: item.querySelector(`.vault-path[data-id="${id}"]`)?.value.trim() || '',
      clippingsFolder: item.querySelector(`.vault-folder[data-id="${id}"]`)?.value.trim() || 'Clippings',
      restApiUrl: item.querySelector(`.vault-api-url[data-id="${id}"]`)?.value.trim() || '',
      restApiKey: item.querySelector(`.vault-api-key[data-id="${id}"]`)?.value.trim() || '',
    };
  });
}

function collectClipSettings() {
  const vaults = readVaultsFromDom();
  let defaultVaultId = defaultVaultSelect.value;
  if (!vaults.find((v) => v.id === defaultVaultId)) {
    defaultVaultId = vaults[0]?.id || '';
  }

  return {
    writeMode: clipWriteModeSelect.value,
    defaultVaultId,
    showFloatingToolbar: showFloatingToolbarInput.checked,
    vaults,
  };
}

function collectSettingsFromForm() {
  return {
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    permanentPrompt: permanentPromptInput.value.trim(),
    clip: collectClipSettings(),
    ui: { fontSize: Number(fontSizeInput.value) || 14 },
  };
}

async function loadSettings() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (!res.ok) return;

  const { settings } = res;
  apiKeyInput.value = settings.apiKey || '';
  modelSelect.value = settings.model || 'gemini-2.5-flash';
  permanentPromptInput.value = settings.permanentPrompt || '';

  state.clip = settings.clip || { writeMode: 'auto', defaultVaultId: '', vaults: [] };
  clipWriteModeSelect.value = state.clip.writeMode || 'auto';
  showFloatingToolbarInput.checked = state.clip.showFloatingToolbar !== false;
  fontSizeInput.value = settings.ui?.fontSize || 14;
  fontSizeLabel.textContent = fontSizeInput.value;
  renderVaults();

  const native = await chrome.runtime.sendMessage({ type: 'NATIVE_HOST_STATUS' });
  if (native?.available) {
    nativeHostStatusEl.textContent = 'Native host: connected ✓';
  } else {
    nativeHostStatusEl.textContent = `Native host: not connected — ${native?.error || 'run install.sh below'}`;
    nativeHostStatusEl.classList.add('error');
  }
}

toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyBtn.textContent = isPassword ? 'Hide' : 'Show';
});

fontSizeInput.addEventListener('input', () => {
  fontSizeLabel.textContent = fontSizeInput.value;
});

addVaultBtn.addEventListener('click', () => {
  state.clip.vaults = readVaultsFromDom();
  state.clip.vaults.push({
    id: createVaultId(),
    name: 'My Vault',
    path: '',
    clippingsFolder: 'Clippings',
    restApiUrl: 'https://127.0.0.1:27124',
    restApiKey: '',
  });
  renderVaults();
});

vaultListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-vault');
  if (!btn) return;
  state.clip.vaults = readVaultsFromDom().filter((v) => v.id !== btn.dataset.id);
  renderVaults();
});

testVaultBtn.addEventListener('click', async () => {
  saveStatus.textContent = 'Testing vault…';
  saveStatus.classList.remove('error');

  const clip = collectClipSettings();
  await chrome.runtime.sendMessage({
    type: 'SAVE_SETTINGS',
    settings: {
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      permanentPrompt: permanentPromptInput.value.trim(),
      clip,
      ui: { fontSize: Number(fontSizeInput.value) || 14 },
    },
  });

  const res = await chrome.runtime.sendMessage({
    type: 'TEST_VAULT',
    vaultId: clip.defaultVaultId,
  });

  if (res.ok) {
    saveStatus.textContent = `Test clip saved via ${res.method}`;
  } else {
    saveStatus.textContent = res.error || 'Test failed';
    saveStatus.classList.add('error');
  }

  setTimeout(() => { saveStatus.textContent = ''; }, 4000);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveStatus.textContent = 'Saving…';
  saveStatus.classList.remove('error');

  const res = await chrome.runtime.sendMessage({
    type: 'SAVE_SETTINGS',
    settings: {
      apiKey: apiKeyInput.value.trim(),
      model: modelSelect.value,
      permanentPrompt: permanentPromptInput.value.trim(),
      clip: collectClipSettings(),
      ui: { fontSize: Number(fontSizeInput.value) || 14 },
    },
  });

  if (res.ok) {
    saveStatus.textContent = 'Saved!';
    state.clip = res.settings.clip;
    renderVaults();
    setTimeout(() => { saveStatus.textContent = ''; }, 2500);
  } else {
    saveStatus.textContent = res.error || 'Failed to save';
    saveStatus.classList.add('error');
  }
});

clearCacheBtn.addEventListener('click', async () => {
  if (!confirm('Clear all cached summaries? This cannot be undone.')) return;

  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith('summary:'));
  if (keys.length) await chrome.storage.local.remove(keys);
  saveStatus.textContent = `Cleared ${keys.length} cached summaries.`;
  setTimeout(() => { saveStatus.textContent = ''; }, 3000);
});

exportSettingsBtn.addEventListener('click', () => {
  const payload = buildSettingsExport(collectSettingsFromForm());
  downloadSettingsExport(payload);
  saveStatus.textContent = 'Settings exported (API key excluded).';
  saveStatus.classList.remove('error');
  setTimeout(() => { saveStatus.textContent = ''; }, 3000);
});

loadSettings();
