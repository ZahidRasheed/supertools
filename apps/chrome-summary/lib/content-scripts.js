export const CONTENT_SCRIPT_FILES = [
  'content/helpers.js',
  'content.js',
];

/**
 * Inject page scripts if they are not already present (e.g. site access "on click").
 * @param {number} tabId
 */
export async function ensureContentScripts(tabId) {
  if (!tabId) return false;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.startsWith('http')) return false;
  } catch {
    return false;
  }

  try {
    const [ping] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => Boolean(window.__summaryContentScript),
    });
    if (ping?.result) return true;
  } catch {
    // Tab may block scripting until the user grants access — try inject below.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: CONTENT_SCRIPT_FILES,
    });
    return true;
  } catch {
    return false;
  }
}
