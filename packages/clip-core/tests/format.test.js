import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dailyFileHeader, formatClipping, todayFilename } from '../src/format.js';

describe('clip format', () => {
  const fixedDate = new Date('2026-06-27T14:30:00');

  it('todayFilename', () => {
    assert.equal(todayFilename(fixedDate), '2026-06-27.md');
  });

  it('dailyFileHeader', () => {
    assert.equal(dailyFileHeader(fixedDate), '# Clippings — Saturday, June 27, 2026\n');
  });

  it('formatClipping with url', () => {
    const out = formatClipping({
      text: 'Line one\nLine two',
      pageTitle: 'Example Article',
      pageUrl: 'https://example.com/page?utm_source=x',
      clippedAt: fixedDate,
    });

    assert.match(out, /## Example Article/);
    assert.match(out, /https:\/\/example\.com\/page/);
    assert.match(out, /\*Clipped Jun 27, 2026/);
    assert.match(out, /> Line one/);
    assert.match(out, /> Line two/);
    assert.match(out, /---\n$/);
    assert.doesNotMatch(out, /utm_source/);
  });

  it('formatClipping without url', () => {
    const out = formatClipping({
      text: 'Hello',
      pageTitle: 'Notes',
      pageUrl: '',
      clippedAt: fixedDate,
    });
    assert.match(out, /## Notes/);
    assert.match(out, /> Hello/);
  });
});
