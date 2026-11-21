import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchModel, lookupPart, families, normalize, normalizeBase } from '../src/fitment.logic.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(fs.readFileSync(path.join(dir, '..', 'assets', 'data', 'fitment.json'), 'utf8'));

test('normalize strips separators and case', () => {
  assert.equal(normalize('rf28k9070sr/aa'), 'RF28K9070SRAA');
  assert.equal(normalizeBase('RF28K9070SR/AA'), 'RF28K9070SR');
  assert.equal(normalize('Ｃｏｒｅ　３００Ｓ'), 'CORE300S');
});

test('exact model lists resolve to a confirmed fitment', () => {
  const r = matchModel(dataset, 'RF28K9070SR/AA');
  assert.equal(r.status, 'matched');
  assert.equal(r.confidence, 'confirmed');
  assert.equal(r.hits[0].partId, 'samsung_haf_cin');
});

test('model number formatting differences still match', () => {
  for (const input of ['rf28k9070sr', 'RF28K9070SR AA', ' RF28K9070SR/AC ']) {
    const r = matchModel(dataset, input);
    assert.equal(r.status, 'matched', `${input} should match`);
    assert.equal(r.hits[0].partId, 'samsung_haf_cin');
  }
});

test('LG model matrix maps different models to different cartridges', () => {
  assert.equal(matchModel(dataset, 'LFCC23596').hits[0].partId, 'lg_lt1000p');
  assert.equal(matchModel(dataset, 'LFD21860').hits[0].partId, 'lg_lt600p');
  assert.equal(matchModel(dataset, 'LFD20786').hits[0].partId, 'lg_lt700p');
});

test('prefix rules return likely, never confirmed', () => {
  const r = matchModel(dataset, 'GFE26JYMFS');
  assert.equal(r.status, 'matched_by_prefix');
  assert.equal(r.confidence, 'likely');
  assert.equal(r.hits[0].partId, 'ge_xwfe');
});

test('one appliance with two filter options asks the user to choose', () => {
  const r = matchModel(dataset, 'Core 300S');
  assert.equal(r.status, 'matched_variants');
  assert.equal(r.hits.length, 2);
  assert.deepEqual(new Set(r.hits.map((h) => h.partId)), new Set(['levoit_core300_rf', 'levoit_core300_rf_sr']));
});

test('numeric humidifier models match exactly', () => {
  assert.equal(matchModel(dataset, '300').hits[0].partId, 'aprilaire_35');
  assert.equal(matchModel(dataset, '400M').hits[0].partId, 'aprilaire_45');
  assert.equal(matchModel(dataset, '500A').hits[0].partId, 'aprilaire_10');
});

test('unknown models stay unknown with a next step, never a guess', () => {
  for (const input of ['RF9999ZZZ', 'ZZZZZZ', '']) {
    const r = matchModel(dataset, input);
    assert.equal(r.confidence, 'unknown');
    assert.ok(r.hint && r.hint.length > 10);
  }
  assert.equal(matchModel(dataset, 'RF9999ZZZ').status, 'unknown');
});

test('reverse lookup by cartridge number works', () => {
  assert.equal(lookupPart(dataset, 'DA29-00020B')[0].partId, 'samsung_haf_cin');
  assert.equal(lookupPart(dataset, 'edr1rxd1')[0].partId, 'whirlpool_edr1rxd1');
  assert.equal(lookupPart(dataset, 'XWFE')[0].partId, 'ge_xwfe');
  assert.deepEqual(lookupPart(dataset, 'NOPE-000'), []);
});

test('brand families give a fallback path when the model is unreadable', () => {
  const fams = families(dataset, 'Samsung');
  assert.ok(fams.length >= 5);
  assert.ok(fams.every((f) => f.family.length >= 3 && f.parts.length >= 1));
});

test('every hit carries a manufacturer source and evidence grade', () => {
  for (const model of ['RF28K9070SR/AA', 'GFE26JYMFS', '300', 'Core 300S']) {
    const r = matchModel(dataset, model);
    for (const h of r.hits) {
      assert.ok(h.sourceUrl && h.sourceUrl.startsWith('https://'), `${model} missing source`);
      assert.ok(['explicit', 'rule', 'part_only'].includes(h.evidenceGrade), `${model} bad grade`);
    }
  }
});
