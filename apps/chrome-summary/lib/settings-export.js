export const SETTINGS_EXPORT_VERSION = 1;

export function sanitizeSettingsForExport(settings) {
  const { apiKey, ...rest } = settings || {};
  return structuredClone(rest);
}

export function buildSettingsExport(settings) {
  return {
    version: SETTINGS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'Summary',
    settings: sanitizeSettingsForExport(settings),
  };
}

export function downloadSettingsExport(payload, filename) {
  const name =
    filename ||
    `summary-settings-${new Date().toISOString().slice(0, 10)}.json`;

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
