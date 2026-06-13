export const SETTINGS_EXPORT_VERSION = 1;

/**
 * Build a portable settings object safe to share or back up (no Gemini API key).
 * @param {object} settings
 */
export function sanitizeSettingsForExport(settings) {
  const { apiKey, ...rest } = settings || {};
  return structuredClone(rest);
}

/**
 * @param {object} settings Raw or form-collected settings (may include apiKey).
 */
export function buildSettingsExport(settings) {
  return {
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'News Reader AI',
    settings: sanitizeSettingsForExport(settings),
  };
}

/**
 * Trigger a JSON file download in the browser.
 * @param {object} payload
 * @param {string} [filename]
 */
export function downloadSettingsExport(payload, filename) {
  const name =
    filename ||
    `news-reader-settings-${new Date().toISOString().slice(0, 10)}.json`;

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
