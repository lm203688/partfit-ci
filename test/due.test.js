import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysBetween, computeDue, formatRemaining, todayStr, STATUS } from '../src/due.js';

test('addMonths clamps at month end', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-01-31', 2), '2026-03-31');
  assert.equal(addMonths('2026-11-21', 6), '2027-05-21');
  assert.equal(addMonths('bad', 6), null);
});

test('daysBetween is DST safe', () => {
  assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2);
  assert.equal(daysBetween('2026-11-01', '2026-12-01'), 30);
});

test('never replaced means due immediately, not negative', () => {
  const d = computeDue({ interval_months: 6 }, '2026-11-21');
  assert.equal(d.status, STATUS.DUE);
  assert.equal(d.reason, 'never_replaced');
  assert.equal(d.nextDueDate, '2026-11-21');
});

test('status tiers: overdue, urgent, due, ok', () => {
  const base = { interval_months: 6 };
  assert.equal(computeDue({ ...base, last_replaced_at: '2026-05-01' }, '2026-11-21').status, STATUS.OVERDUE);
  assert.equal(computeDue({ ...base, last_replaced_at: '2026-06-01' }, '2026-11-21').status, STATUS.URGENT);
  assert.equal(computeDue({ ...base, last_replaced_at: '2026-06-15' }, '2026-11-21').status, STATUS.DUE);
  assert.equal(computeDue({ ...base, last_replaced_at: '2026-08-01' }, '2026-11-21').status, STATUS.OK);
});

test('remaining text is human readable', () => {
  assert.equal(formatRemaining(null), 'Not scheduled');
  assert.equal(formatRemaining(0), 'Due today');
  assert.equal(formatRemaining(-9), '9 days overdue');
  assert.equal(formatRemaining(120), '4 months left');
});

test('todayStr is zero padded', () => {
  assert.match(todayStr(new Date(2026, 0, 5)), /^2026-01-05$/);
});
