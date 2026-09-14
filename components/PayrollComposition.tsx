'use client'
import Link from 'next/link'
import { Panel, Period } from './PayrollWorkspace'
import { categories, categoryLabels, money, number } from '@/lib/payroll-domain'

export const earningColors = ['#2563eb', '#c66b08', '#c0265b', '#0d9488']

export function PayrollComposition({ period }: { period: Period }) {
  const total = period.total_earnings
  const rows = categories.map((key, i) => ({
    key,
    color: earningColors[i],
    value: period.breakdown[`${key}_earnings`] || 0,
  }))
  const drawable = total > 0 && rows.every((r) => r.value >= 0)
  let end = 0
  const stops = rows.map((r) => {
    const start = end
    end += total > 0 ? (r.value / total) * 100 : 0
    return `${r.color} ${start}% ${end}%`
  })
  const allocation = [
    {
      label: 'Employee take-home',
      value: period.total_net_pay,
      color: '#0d9488',
    },
    {
      label: 'Tax withholdings',
      value: period.total_withholdings,
      color: '#2563eb',
    },
    {
      label: 'Other deductions',
      value: period.total_deductions,
      color: '#7c3aed',
    },
  ]
  return (
    <Panel
      title="Inside this payroll"
      description="Where gross pay comes from — and how it reaches employees."
    >
      <div className="pw-composition">
        <div className="pw-earnings-mix">
          {drawable && (
            <div
              className="pw-donut"
              aria-hidden="true"
              style={{ background: `conic-gradient(${stops.join(',')})` }}
            >
              <div>
                <span>EARNINGS MIX</span>
                <strong>
                  {number(((rows[1].value + rows[2].value) / total) * 100)}%
                </strong>
                <small>OT + Double Time pay</small>
              </div>
            </div>
          )}
          <div className="pw-mix-legend">
            {rows.map((r) => (
              <Link
                key={r.key}
                href={`/source/${period.id}?category=${r.key}`}
                className="pw-mix-row"
              >
                <span className="pw-dot" style={{ background: r.color }} />
                <span>
                  {categoryLabels[r.key]}
                  <small>
                    {total
                      ? number((r.value / total) * 100) + '% of gross'
                      : 'No gross pay'}
                  </small>
                </span>
                <strong>{money(r.value)}</strong>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="pw-pay-allocation">
          <span className="pw-eyebrow">Gross to take-home</span>
          <div className="pw-allocation-title">
            <strong>{money(period.total_net_pay)}</strong>
            <span>
              {total
                ? number((period.total_net_pay / total) * 100) +
                  '% of gross pay'
                : 'No gross pay'}
            </span>
          </div>
          <div className="pw-allocation-bar" aria-hidden="true">
            {allocation.map((a) => (
              <span
                key={a.label}
                style={{
                  width: `${total > 0 ? (Math.max(0, a.value) / total) * 100 : 0}%`,
                  background: a.color,
                }}
              />
            ))}
          </div>
          {allocation.map((a) => (
            <div className="pw-allocation-row" key={a.label}>
              <span>
                <i className="pw-dot" style={{ background: a.color }} />
                {a.label}
              </span>
              <strong>{money(a.value)}</strong>
            </div>
          ))}
          <p>
            Employee pay only. Employer taxes and benefits are not included.
          </p>
        </div>
      </div>
    </Panel>
  )
}
