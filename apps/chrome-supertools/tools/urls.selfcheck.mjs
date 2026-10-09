import assert from 'node:assert/strict';
import { httpUrlsFromTabs, urlsToClipboardText, copyStatusMessage } from './urls.js';

assert.deepEqual(
  httpUrlsFromTabs([
    { url: 'chrome://extensions' },
    { url: 'https://a.example' },
    { url: undefined },
    { url: 'http://b.example' },
    {},
  ]),
  ['https://a.example', 'http://b.example']
);
assert.equal(urlsToClipboardText(['https://a.example', 'http://b.example']), 'https://a.example\nhttp://b.example');
assert.equal(urlsToClipboardText([]), '');
assert.deepEqual(httpUrlsFromTabs([]), []);
assert.equal(copyStatusMessage(2), 'Copied 2 URLs');
assert.equal(copyStatusMessage(0), 'No http(s) tabs in this window');
console.log('urls.selfcheck: ok');
