import assert from 'node:assert/strict';
import { stripAllAttributes } from './render-summary.js';

function fakeEl(attrs) {
  const map = new Map(Object.entries(attrs));
  return {
    get attributes() {
      return [...map.keys()].map((name) => ({ name }));
    },
    removeAttribute(name) {
      map.delete(name);
    },
    snapshot() {
      return Object.fromEntries(map);
    },
  };
}

const el = fakeEl({ onclick: 'alert(1)', class: 'lead', 'data-x': 'y' });
stripAllAttributes(el);
assert.deepEqual(el.snapshot(), {});

const img = fakeEl({ onerror: 'fetch("//evil")', src: 'x' });
stripAllAttributes(img);
assert.deepEqual(img.snapshot(), {});

console.log('render-summary.selfcheck: ok');
