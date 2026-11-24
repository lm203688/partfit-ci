import test from 'node:test';
import assert from 'node:assert/strict';
import { spotlightPayload } from '../src/spotlight.pick.js';

const rows = [
  {
    id: 1,
    nickname: 'Kitchen fridge',
    brand: 'Samsung',
    model: 'RF28K9070SR/AA',
    part_no: 'DA29-00020B',
    category: 'refrigerator',
    due: { status: 'overdue', daysLeft: -9 },
  },
  {
    id: 2,
    nickname: '',
    brand: 'Whirlpool',
    model: 'ED5VHEXVB01',
    part_no: 'EDR3RXD1',
    category: 'refrigerator',
    due: { status: 'ok', daysLeft: 120 },
  },
];

test('spotlight: one item per appliance, stable unique id', () => {
  const items = spotlightPayload(rows);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'appliance:1');
  assert.equal(items[1].id, 'appliance:2');
});

test('spotlight: title prefers nickname, falls back to brand + model', () => {
  const items = spotlightPayload(rows);
  assert.equal(items[0].title, 'Kitchen fridge');
  assert.equal(items[1].title, 'Whirlpool ED5VHEXVB01');
});

test('spotlight: description carries model, part number and remaining time', () => {
  const items = spotlightPayload(rows);
  assert.equal(items[0].description, 'Samsung RF28K9070SR/AA · Filter DA29-00020B · 9 days overdue');
  assert.match(items[1].description, /Filter EDR3RXD1 · 4 months left/);
});

test('spotlight: keywords are de-duplicated and searchable', () => {
  const items = spotlightPayload(rows);
  for (const kw of ['Kitchen fridge', 'Samsung', 'RF28K9070SR/AA', 'DA29-00020B', 'filter']) {
    assert.ok(items[0].keywords.includes(kw), `missing keyword ${kw}`);
  }
  assert.equal(new Set(items[0].keywords).size, items[0].keywords.length);
});

test('spotlight: empty or malformed rows produce no items', () => {
  assert.deepEqual(spotlightPayload([]), []);
  assert.deepEqual(spotlightPayload(null), []);
  assert.deepEqual(spotlightPayload([{ nickname: 'x' }]), []);
});
