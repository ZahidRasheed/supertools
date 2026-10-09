export function httpUrlsFromTabs(tabs) {
  return tabs
    .map((tab) => tab?.url)
    .filter((url) => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')));
}

export function urlsToClipboardText(urls) {
  return urls.join('\n');
}

export function copyStatusMessage(count) {
  return count > 0 ? `Copied ${count} URLs` : 'No http(s) tabs in this window';
}
