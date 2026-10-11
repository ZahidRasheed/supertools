import { cleanUrl } from './url-clean.js';

export async function run() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    if (typeof url !== 'string' || !(url.startsWith('http://') || url.startsWith('https://'))) {
      return 'No http(s) tab to copy';
    }
    await navigator.clipboard.writeText(cleanUrl(url));
    return 'Copied cleaned link';
  } catch (err) {
    return err?.message || 'Could not copy link';
  }
}
