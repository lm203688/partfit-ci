import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES, FEEDBACK_EMAIL, createSession, buildBundle, nextId, validateBundle, toText, toMailto,
} from '../src/feedback.js';

test('bundle defaults to a safe category and keeps the note bounded', () => {
  const s = createSession({ version: '1.1.0', build: '7' });
  const b = buildBundle({ category: 'not-a-category', note: 'x'.repeat(1500) }, {}, s);
  assert.equal(b.category, 'other');
  assert.equal(b.user_note.length, 1200);
  assert.equal(b.app, 'PartFit');
  assert.equal(b.version, '1.1.0');
  assert.equal(b.build, '7');
});

test('bundle only carries ids, never free-form screen text', () => {
  const s = createSession();
  const b = buildBundle({ category: 'wrong_part', note: 'EDR4RXD1 should fit' }, {}, s);
  assert.deepEqual(b.last_actions, []);
  assert.deepEqual(validateBundle(b), []);
});

test('feedback ids increment per prefix', () => {
  assert.equal(nextId([], 'PF'), 'PF-0001');
  assert.equal(nextId(['PF-0001', 'PF-0003', 'PC-0009'], 'PF'), 'PF-0004');
  assert.equal(nextId(['PC-0009'], 'PC'), 'PC-0010');
});

test('validation catches unbounded or malformed bundles', () => {
  const s = createSession();
  const b = buildBundle({ category: 'crash' }, {}, s);
  assert.deepEqual(validateBundle(b), []);
  assert.ok(validateBundle({ ...b, category: 'nope' }).includes('unknown category'));
  assert.ok(validateBundle({ ...b, last_actions: ['a', 7] }).includes('actions must be ids'));
});

test('report text and mailto are human readable and address the developer', () => {
  const s = createSession({ version: '1.1.0', build: '7', device: 'iPhone', os: 'iOS 27.1', locale: 'en-US' });
  const b = { ...buildBundle({ category: 'wrong_part', note: 'Says EDR1RXD1 but the sticker says EDR4RXD1' }, {}, s), id: 'PF-0001' };
  const t = toText(b);
  assert.match(t, /Feedback PF-0001/);
  assert.match(t, /Category: wrong_part/);
  assert.match(t, /EDR4RXD1/);
  const url = toMailto(b);
  assert.ok(url.startsWith('mailto:' + FEEDBACK_EMAIL + '?'));
  assert.ok(url.includes('subject='));
  assert.ok(CATEGORIES.every((c) => typeof c === 'string'));
});
