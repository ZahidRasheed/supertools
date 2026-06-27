import { buildSettingsExport, downloadSettingsExport } from '../lib/settings-export.js';

const form = document.getElementById('settings-form');
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model');
const permanentPromptInput = document.getElementById('permanent-prompt');
const toggleKeyBtn = document.getElementById('toggle-key');
const clearCacheBtn = document.getElementById('clear-cache');
const saveStatus = document.getElementById('save-status');
const fontSizeInput = document.getElementById('font-size');
const fontSizeLabel = document.getElementById('font-size-label');
const exportSettingsBtn = document.getElementById('export-settings');

function collectSettingsFromForm() {
  return {
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    permanentPrompt: permanentPromptInput.value.trim(),
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
  fontSizeInput.value = settings.ui?.fontSize || 14;
  fontSizeLabel.textContent = fontSizeInput.value;
}

toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyBtn.textContent = isPassword ? 'Hide' : 'Show';
});

fontSizeInput.addEventListener('input', () => {
  fontSizeLabel.textContent = fontSizeInput.value;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveStatus.textContent = 'Saving…';
  saveStatus.classList.remove('error');

  const res = await chrome.runtime.sendMessage({
    type: 'SAVE_SETTINGS',
    settings: collectSettingsFromForm(),
  });

  if (res.ok) {
    saveStatus.textContent = 'Saved!';
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
