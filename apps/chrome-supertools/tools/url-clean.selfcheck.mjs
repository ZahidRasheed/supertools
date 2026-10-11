import assert from 'node:assert/strict';
import { cleanUrl } from './url-clean.js';

assert.equal(
  cleanUrl('https://example.com/path?utm_source=x&id=42&fbclid=abc#frag'),
  'https://example.com/path'
);
assert.equal(
  cleanUrl('https://shop.example/item?sku=99&ref=email'),
  'https://shop.example/item'
);
assert.equal(cleanUrl('https://example.com/path/'), 'https://example.com/path');
assert.equal(cleanUrl('https://example.com/'), 'https://example.com/');
assert.equal(cleanUrl('not-a-url'), 'not-a-url');
console.log('url-clean.selfcheck: ok');
