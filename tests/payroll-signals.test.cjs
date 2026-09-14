require('./load-ts.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { payrollSignals } = require('../lib/payroll-signals.ts')

function period(index, dt, ot = 500, days = 13) {
  const end = new Date(Date.UTC(2026, 0, 16 + index * 14))
  const start = new Date(end.getTime() - days * 86400000)
  return {
    id: String(index),
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    breakdown: {
      double_time_hours: dt,
      double_time_earnings: dt * 40,
      overtime_hours: ot,
      overtime_earnings: ot * 30,
    },
  }
}
test('company Double Time flags an unusual total even when it is spread across employees', () => {
  const history = [0, 0, 0, 9.5, 6, 7].map((dt, i) => period(i, dt))
  const now = period(6, 72.5)
  const [signal] = payrollSignals(now, [now, ...history, period(7, 900)])
  assert.equal(signal.category, 'double_time')
  assert.equal(signal.current, 72.5)
  assert.equal(signal.previous, 7)
  assert.equal(signal.baseline, 3)
  assert.equal(signal.baseline_count, 6)
  assert.equal(signal.earnings_change, 2620)
})
test('a repeated unusual period still stands out; sustained normal levels stop flagging', () => {
  const history = [0, 0, 9.5, 6, 7, 72.5].map((dt, i) => period(i, dt))
  assert.equal(payrollSignals(period(6, 72.5), history).length, 1)
  assert.equal(
    payrollSignals(
      period(6, 72.5),
      history.map((p) => ({
        ...p,
        breakdown: { ...p.breakdown, double_time_hours: 72.5 },
      })),
    ).length,
    0,
  )
})
test('small fluctuations, zero Double Time and ordinary overtime do not trigger company alerts', () => {
  const history = [0, 0, 0, 9.5, 6, 7].map((dt, i) => period(i, dt))
  assert.equal(payrollSignals(period(6, 9.5, 527.8), history).length, 0)
  assert.equal(payrollSignals(period(6, 0), history).length, 0)
  assert.equal(payrollSignals(period(6, 100), []).length, 0)
})
test('baseline excludes future and different length payrolls; sparse history is labeled accurately', () => {
  const [signal] = payrollSignals(period(6, 72.5), [
    period(5, 7),
    period(4, 900, 500, 6),
    period(7, 900),
  ])
  assert.equal(signal.baseline, 7)
  assert.equal(signal.baseline_count, 1)
  assert.match(signal.explanation, /preceding payroll of the same length/)
})
