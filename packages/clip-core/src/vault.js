export const VAULT_CONFIG_VERSION = 1;

/** @typedef {{ id: string, name: string, path: string, clippingsFolder?: string }} Vault */

/**
 * @param {object} [raw]
 * @returns {{ version: number, defaultVaultId: string, vaults: Vault[] }}
 */
export function normalizeVaultConfig(raw = {}) {
  const vaults = Array.isArray(raw.vaults) ? raw.vaults : [];
  let defaultVaultId = raw.defaultVaultId || '';
  if (!vaults.find((v) => v.id === defaultVaultId)) {
    defaultVaultId = vaults[0]?.id || '';
  }
  return {
    version: VAULT_CONFIG_VERSION,
    defaultVaultId,
    vaults: vaults.map((v) => ({
      id: v.id || createVaultId(),
      name: v.name || 'Vault',
      path: v.path || '',
      clippingsFolder: v.clippingsFolder || 'Clippings',
    })),
  };
}

export function createVaultId() {
  return `vault_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * @param {{ defaultVaultId?: string, vaults: Vault[] }} config
 * @param {string} [vaultId]
 */
export function resolveVault(config, vaultId) {
  const vaults = config.vaults || [];
  if (!vaults.length) return null;
  const id = vaultId || config.defaultVaultId;
  return vaults.find((v) => v.id === id) || vaults[0];
}

/**
 * Convert legacy Chrome extension settings export to vault config.
 * @param {object} exportPayload
 */
export function vaultConfigFromExtensionExport(exportPayload) {
  const clip = exportPayload?.settings?.clip || exportPayload?.clip || {};
  return normalizeVaultConfig({
    defaultVaultId: clip.defaultVaultId,
    vaults: (clip.vaults || []).map((v) => ({
      id: v.id,
      name: v.name,
      path: v.path,
      clippingsFolder: v.clippingsFolder,
    })),
  });
}
