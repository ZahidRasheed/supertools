export const DEFAULT_UI = {
  fontSize: 14,
};

export const DEFAULT_CLIP_SETTINGS = {
  writeMode: 'auto',
  defaultVaultId: '',
  showFloatingToolbar: true,
  vaults: [],
};

export function createVaultId() {
  return `vault_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {object} settings
 * @returns {import('./clip-settings.js').DEFAULT_CLIP_SETTINGS & object}
 */
export function getClipSettings(settings) {
  return {
    ...DEFAULT_CLIP_SETTINGS,
    ...(settings?.clip || {}),
    vaults: Array.isArray(settings?.clip?.vaults) ? settings.clip.vaults : [],
  };
}

/**
 * @param {object} clipSettings
 * @param {string} [vaultId]
 */
export function resolveVault(clipSettings, vaultId) {
  const vaults = clipSettings.vaults || [];
  if (!vaults.length) return null;

  const id = vaultId || clipSettings.defaultVaultId;
  return vaults.find((v) => v.id === id) || vaults[0];
}
