require('./load-ts.cjs')
const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { compareImport } = require('../lib/payroll-import-preview.ts')
const payroll = (id, doubleTime) => ({
  check_date: '2026-09-16',
  totals: { total_persons: 1, total_earnings: 1800 },
  employees: [
    {
      employee_id: id,
      payroll_entry: {
        regular_hours: 80,
        regular_earnings: 1600,
        double_time_hours: doubleTime,
        double_time_earnings: doubleTime * 40,
      },
    },
  ],
})
test('new payroll has no replacement comparison', () => {
  assert.equal(compareImport(payroll(1, 5)), null)
})
test('comparison supports retained baseline snapshots and identifies employee replacement even when counts match', () => {
  const previous = payroll(1, 5)
  previous.totals = {
    ...previous.totals,
    total_earnings: '1800',
    raw_text: 'Must not be returned',
  }
  const comparison = compareImport(payroll(2, 10), previous)
  assert.equal(comparison.addedEmployees, 1)
  assert.equal(comparison.removedEmployees, 1)
  assert.equal(comparison.breakdown.double_time_hours, 5)
  assert.equal(comparison.breakdown.double_time_earnings, 200)
  assert.equal(comparison.breakdown.overtime_hours, 0)
  assert.equal(comparison.totals.total_earnings, 1800)
  assert.equal(comparison.totals.raw_text, undefined)
})
