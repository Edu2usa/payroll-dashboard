require('./load-ts.cjs')
const { test } = require('node:test'),
  assert = require('node:assert/strict')
const { buildAlerts } = require('../lib/payroll-alerts.ts')
const {
  dateOnly,
  previousPeriod,
  contributions,
  csvText,
} = require('../lib/payroll-domain.ts')
const entry = (overrides = {}) => ({
  employee_id: 'a',
  department: 1,
  total_hours: 80,
  regular_hours: 80,
  regular_rate: 20,
  regular_earnings: 1600,
  total_earnings: 1600,
  total_withholdings: 0,
  total_deductions: 0,
  net_pay: 1600,
  ...overrides,
})
const flags = (current, previous = []) =>
  buildAlerts({ id: 'current' }, { id: 'previous' }, current, previous)
test('date-only check date preserves its day in Eastern time', () => {
  process.env.TZ = 'America/New_York'
  assert.equal(dateOnly('2026-09-16'), 'Sep 16, 2026')
})
test('backdated payroll uses its immediate predecessor, never a later payroll', () => {
  const periods = [
    { id: 'new', period_end: '2026-09-11' },
    { id: 'middle', period_end: '2026-08-28' },
    { id: 'old', period_end: '2026-08-14' },
  ]
  assert.equal(previousPeriod(periods[1], periods).id, 'old')
  assert.equal(previousPeriod(periods[2], periods), null)
})
test('salary and multiple-rate totals do not create false earnings anomalies', () => {
  assert.equal(
    flags([entry({ total_hours: 0, regular_hours: 0 })]).some(
      (f) => f.type === 'earnings_anomaly',
    ),
    false,
  )
  assert.equal(
    flags([entry({ regular_rate: 25 })]).some(
      (f) => f.type === 'earnings_anomaly',
    ),
    false,
  )
})
test('new employees still receive independent calculation checks', () => {
  const a = flags([entry({ net_pay: 1300 })])
  assert.ok(a.some((f) => f.type === 'new_employee'))
  assert.ok(a.some((f) => f.field === 'net_pay'))
  assert.ok(a.every((f) => f.employee_id === 'a'))
})
test('zero hours transitions are flagged with signed percentages', () => {
  const a = flags(
    [entry({ total_hours: 0, regular_hours: 0 })],
    [entry()],
  ).find((f) => f.field === 'total_hours')
  assert.equal(a.percent_change, -100)
  assert.equal(a.difference, -80)
})
test('deductions starting or stopping are flagged', () => {
  assert.ok(
    flags([entry({ total_deductions: 100, net_pay: 1500 })], [entry()]).some(
      (f) => f.type === 'deduction_change',
    ),
  )
  assert.ok(
    flags([entry()], [entry({ total_deductions: 100, net_pay: 1500 })]).some(
      (f) => f.type === 'deduction_change',
    ),
  )
})
test('contributions account for new, absent and continuing employees exactly', () => {
  const now = [
      entry({ total_earnings: 1900 }),
      entry({ employee_id: 'b', total_earnings: 500 }),
    ],
    before = [entry(), entry({ employee_id: 'c', total_earnings: 1000 })]
  const c = contributions(now, before)
  assert.equal(
    c.reduce((n, e) => n + e.difference, 0),
    -200,
  )
  assert.equal(c[0].status, 'Absent this period')
})
test('CSV escapes formulas, delimiters, quotes and line breaks without changing numeric negatives', () => {
  const text = csvText([['=HYPERLINK("test")', 'A,B', 'Line\nTwo', -5]])
  assert.ok(text.includes('"\'=HYPERLINK(""test"")"'))
  assert.ok(text.includes('"A,B"'))
  assert.ok(text.includes('"-5"'))
})
