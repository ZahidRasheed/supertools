import assert from 'node:assert/strict';
import { statusFromToolRun } from './run-tool.js';

assert.equal(await statusFromToolRun(async () => 'Copied 2 URLs'), 'Copied 2 URLs');
assert.equal(await statusFromToolRun(async () => { throw new Error('boom'); }), 'boom');
assert.equal(await statusFromToolRun(async () => { throw 'x'; }), 'Tool failed');
console.log('run-tool.selfcheck: ok');
