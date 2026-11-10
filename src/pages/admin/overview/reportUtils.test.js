import test from 'node:test';
import assert from 'node:assert/strict';
import { csvContent, dateInput, presetRange, validateRange } from './reportUtils.js';

test('quick ranges include exactly the selected number of local calendar days', () => {
  const now = new Date(2026, 0, 2, 0, 10);
  assert.equal(dateInput(now), '2026-01-02');
  assert.deepEqual(presetRange('1', now), { from: '2026-01-02', to: '2026-01-02' });
  assert.deepEqual(presetRange('7', now), { from: '2025-12-27', to: '2026-01-02' });
  assert.deepEqual(presetRange('month', now), { from: '2026-01-01', to: '2026-01-02' });
});
test('date validation rejects incomplete, invalid, reversed and oversized ranges', () => {
  for (const range of [{ from: '', to: '2026-01-01' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-02-02', to: '2026-02-01' }, { from: '2026-01-01', to: '2027-01-02' }]) assert.ok(validateRange(range));
  assert.equal(validateRange({ from: '2026-01-01', to: '2027-01-01' }), ''); // 366 inclusive days.
});
test('CSV preserves Vietnamese, quotes and protects spreadsheet formula cells', () => {
  const csv = csvContent(['Tên món', 'Doanh thu'], [['Bắp "L"; ngọt', 50000], ['=HYPERLINK("bad")', 1], [' @SUM(1)', 2]]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Bắp ""L""; ngọt";"50000"'));
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"\' @SUM(1)"'));
});
