import { copyStatusMessage, httpUrlsFromTabs, urlsToClipboardText } from './urls.js';

export async function run() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const urls = httpUrlsFromTabs(tabs);
    if (urls.length === 0) {
      return copyStatusMessage(0);
    }
    await navigator.clipboard.writeText(urlsToClipboardText(urls));
    return copyStatusMessage(urls.length);
  } catch (err) {
    return err?.message || 'Could not copy URLs';
  }
}
