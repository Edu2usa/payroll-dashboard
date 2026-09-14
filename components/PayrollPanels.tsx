'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Banknote,
  Users,
  Clock,
  Timer,
  ClipboardCheck,
} from 'lucide-react'
import {
  Alert,
  Period,
  Panel,
  usePayroll,
  downloadCSV,
  requestJSON,
} from './PayrollWorkspace'
import {
  categories,
  categoryLabels,
  money,
  number,
  contributions,
  percentChange,
  dateOnly,
} from '@/lib/payroll-domain'

export function PeriodStatus({ period }: { period: Period }) {
  return (
    <div className="pw-statuses">
      <span
        className={`pw-badge ${period.reconciliation.matches ? 'ok' : 'high'}`}
      >
        {period.reconciliation.matches
          ? '✓ Matches journal'
          : '! Journal mismatch'}
      </span>
      <span className="pw-badge">
        {period.reviewed
          ? `Reviewed by ${period.reviewed_by} · ${dateOnly(period.reviewed_at)}`
          : 'Not yet reviewed by a person'}
      </span>
      {period.reconciliation.issues.length > 0 && (
        <span className="pw-badge high">
          Check: {period.reconciliation.issues.join(', ')}
        </span>
      )}
    </div>
  )
}
export function Summary({ period }: { period: Period }) {
  const b = period.breakdown
  const icons = [Wallet, Banknote, Users, Clock, Timer, ClipboardCheck]
  return (
    <>
      <PeriodStatus period={period} />
      <div className="pw-metrics">
        {[
          [
            'Gross pay',
            money(period.total_earnings),
            'Before taxes and deductions',
            '',
          ],
          [
            'Net pay',
            money(period.total_net_pay),
            'Employee take-home pay',
            '',
          ],
          [
            'Total hours',
            number(period.total_hours),
            `${period.total_persons} employees`,
            '',
          ],
          [
            'Overtime',
            `${number(b.overtime_hours)} h`,
            money(b.overtime_earnings),
            `/source/${period.id}?category=overtime`,
          ],
          [
            'Double Time',
            `${number(b.double_time_hours)} h`,
            money(b.double_time_earnings),
            `/source/${period.id}?category=double_time`,
          ],
          [
            'Needs review',
            String(period.open_alerts),
            'Open review items',
            '/review',
          ],
        ].map(([label, value, detail, href], i) => {
          const Icon = icons[i]
          return (
            <div className={`pw-metric pw-metric-${i}`} key={label}>
              <div className="pw-metric-top">
                <span className="pw-label">{label}</span>
                <Icon size={19} aria-hidden="true" />
              </div>
              {href ? (
                <Link href={href}>
                  <strong>{value}</strong>
                </Link>
              ) : (
                <strong>{value}</strong>
              )}
              <small>{detail}</small>
            </div>
          )
        })}
      </div>
    </>
  )
}
export function ReviewForm({
  id,
  reviewed,
  onCancel,
}: {
  id: string
  reviewed: boolean
  onCancel: () => void
}) {
  const { refresh } = usePayroll(),
    [actor, setActor] = useState(''),
    [note, setNote] = useState(''),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('')
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await requestJSON('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, actor, note, is_reviewed: !reviewed }),
      })
      await refresh()
      onCancel()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className="pw-review-form" onSubmit={save}>
      <h3>{reviewed ? 'Reopen review' : 'Record your review'}</h3>
      <p>
        Your entered name is recorded with this action. The application uses a
        shared login.
      </p>
      <label>
        Your name
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          required
          maxLength={120}
        />
      </label>
      <label>
        Review note
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="What did you verify or explain?"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="pw-actions">
        <button className="pw-primary" disabled={saving}>
          {saving ? 'Saving…' : reviewed ? 'Reopen item' : 'Save review'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
export function ReviewList({
  alerts,
  limit,
}: {
  alerts: Alert[]
  limit?: number
}) {
  const { name, data } = usePayroll(),
    [editing, setEditing] = useState('')
  return (
    <>
      {alerts.length === 0 ? (
        <p className="pw-empty">No review items match this view.</p>
      ) : (
        alerts.slice(0, limit).map((a) => {
          const employee = data.employees.find((e) => e.id === a.employee_id)
          return (
            <div className="pw-alert" key={a.id}>
              <div>
                <div className="pw-actions">
                  <Link href={`/employees/${a.employee_id}`}>
                    <strong>{name(a.employee_id)}</strong>
                  </Link>
                  <span className={`pw-badge ${a.severity}`}>
                    {a.severity === 'high'
                      ? '! High priority'
                      : a.severity === 'medium'
                        ? 'Review'
                        : 'Information'}
                  </span>
                  <span className="pw-badge">{a.field.replace(/_/g, ' ')}</span>
                </div>
                <p>{a.notes}</p>
                <small>
                  Previous:{' '}
                  {a.previous_value === null ? '—' : number(a.previous_value)} ·
                  Current:{' '}
                  {a.current_value === null ? '—' : number(a.current_value)}
                  {a.difference !== null &&
                    ` · Change: ${a.difference >= 0 ? '+' : ''}${number(a.difference)}`}
                </small>
                {a.is_reviewed && (
                  <small>
                    Reviewed by {a.reviewed_by} · {dateOnly(a.reviewed_at)}
                    {a.review_note && ` · ${a.review_note}`}
                  </small>
                )}
                {editing === a.id && (
                  <ReviewForm
                    id={a.id}
                    reviewed={a.is_reviewed}
                    onCancel={() => setEditing('')}
                  />
                )}
              </div>
              <div className="pw-alert-actions">
                <Link
                  className="pw-button"
                  href={`/source/${a.current_period_id}?employee=${a.employee_id}`}
                >
                  Source
                </Link>
                {a.previous_period_id && (
                  <Link
                    className="pw-button"
                    href={`/source/${a.previous_period_id}?employee=${a.employee_id}`}
                  >
                    Previous source
                  </Link>
                )}
                <button onClick={() => setEditing(a.id)}>
                  {a.is_reviewed ? 'Reopen' : 'Review item'}
                </button>
              </div>
            </div>
          )
        })
      )}
    </>
  )
}
export function Changes({
  current,
  previous,
}: {
  current: Period
  previous: Period
}) {
  const { data, name } = usePayroll(),
    [filter, setFilter] = useState('')
  const changes = contributions(
    data.entries.filter((e) => e.payroll_period_id === current.id),
    data.entries.filter((e) => e.payroll_period_id === previous.id),
  )
  const shown = changes.filter(
    (c) =>
      Math.abs(c.difference) > 0.005 &&
      name(c.employee_id).toLowerCase().includes(filter.toLowerCase()),
  )
  const sums = ['New this period', 'Absent this period', 'Continuing'].map(
    (status) => ({
      status,
      total: changes
        .filter((c) => c.status === status)
        .reduce((n, c) => n + c.difference, 0),
    }),
  )
  const delta = current.total_earnings - previous.total_earnings
  return (
    <Panel
      title="What changed"
      description={`Gross pay ${delta >= 0 ? 'increased' : 'decreased'} by ${money(Math.abs(delta))}. Contributions below add up to the full change.`}
      action={
        <button
          onClick={() =>
            downloadCSV('payroll-changes.csv', [
              [
                'Employee',
                'Status',
                'Gross change',
                'Hours change',
                ...categories.map(
                  (k) => categoryLabels[k] + ' earnings change',
                ),
              ],
              ...shown.map((c) => [
                name(c.employee_id),
                c.status,
                c.difference,
                c.hours_difference,
                ...categories.map((k) => c.categories[k]),
              ]),
            ])
          }
        >
          Export CSV
        </button>
      }
    >
      <div className="pw-contributions">
        {sums.map((s) => (
          <div className="pw-contribution" key={s.status}>
            <span className="pw-label">{s.status}</span>
            <strong>
              {s.total >= 0 ? '+' : ''}
              {money(s.total)}
            </strong>
            <div className="pw-contribution-track" aria-hidden="true">
              <span
                style={{
                  width: `${(Math.abs(s.total) / Math.max(1, ...sums.map((s) => Math.abs(s.total)))) * 100}%`,
                }}
              />
            </div>
            <small>
              {s.total === 0
                ? 'No impact on gross pay'
                : s.total > 0
                  ? 'Added to gross pay'
                  : 'Reduced gross pay'}
            </small>
          </div>
        ))}
      </div>
      <label className="pw-toolbar">
        Find employee
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search name"
        />
      </label>
      <div className="pw-scroll">
        <table className="pw-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Gross change</th>
              <th>Hours change</th>
              {categories.map((k) => (
                <th key={k}>{categoryLabels[k]} pay change</th>
              ))}
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.employee_id}>
                <td>
                  <Link href={`/employees/${c.employee_id}`}>
                    {name(c.employee_id)}
                  </Link>
                </td>
                <td>
                  <strong>
                    {c.difference > 0 ? '+' : ''}
                    {money(c.difference)}
                  </strong>
                </td>
                <td>{number(c.hours_difference)}</td>
                {categories.map((k) => (
                  <td key={k}>{money(c.categories[k])}</td>
                ))}
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pw-muted">
        Category changes show where costs moved. Average hourly rates and source
        earning lines are available in each employee’s history.
      </p>
    </Panel>
  )
}
export function Breakdown({
  current,
  previous,
}: {
  current: Period
  previous?: Period
}) {
  const a = current.breakdown,
    b = previous?.breakdown
  const pct = (c: number, p: number) => {
    const v = percentChange(c || 0, p || 0)
    return v === null ? '—' : `${v > 0 ? '+' : ''}${number(v)}%`
  }
  return (
    <Panel
      title="Hours & earnings"
      description="Select a category to see the employees and journal behind it."
      action={
        <button
          onClick={() =>
            downloadCSV('hours-and-earnings.csv', [
              [
                'Category',
                'Current hours',
                'Previous hours',
                'Current earnings',
                'Previous earnings',
              ],
              ...categories.map((k) => [
                categoryLabels[k],
                a[`${k}_hours`] || 0,
                b?.[`${k}_hours`] ?? '',
                a[`${k}_earnings`] || 0,
                b?.[`${k}_earnings`] ?? '',
              ]),
            ])
          }
        >
          Export CSV
        </button>
      }
    >
      <div className="pw-scroll">
        <table className="pw-table">
          <thead>
            <tr>
              <th rowSpan={2}>Category</th>
              <th colSpan={previous ? 4 : 1}>Hours</th>
              <th colSpan={previous ? 4 : 1}>Earnings</th>
            </tr>
            <tr>
              <th>Current</th>
              {previous && (
                <>
                  <th>Previous</th>
                  <th>Change</th>
                  <th>Change %</th>
                </>
              )}
              <th>Current</th>
              {previous && (
                <>
                  <th>Previous</th>
                  <th>Change</th>
                  <th>Change %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {categories.map((k) => (
              <tr key={k}>
                <td>
                  <Link href={`/source/${current.id}?category=${k}`}>
                    {categoryLabels[k]}
                  </Link>
                </td>
                <td>
                  <Link href={`/source/${current.id}?category=${k}`}>
                    {number(a[`${k}_hours`])}
                  </Link>
                </td>
                {b && (
                  <>
                    <td>
                      <Link href={`/source/${previous!.id}?category=${k}`}>
                        {number(b[`${k}_hours`])}
                      </Link>
                    </td>
                    <td>
                      {number((a[`${k}_hours`] || 0) - (b[`${k}_hours`] || 0))}
                    </td>
                    <td>{pct(a[`${k}_hours`], b[`${k}_hours`])}</td>
                  </>
                )}
                <td>{money(a[`${k}_earnings`])}</td>
                {b && (
                  <>
                    <td>{money(b[`${k}_earnings`])}</td>
                    <td>
                      {money(
                        (a[`${k}_earnings`] || 0) - (b[`${k}_earnings`] || 0),
                      )}
                    </td>
                    <td>{pct(a[`${k}_earnings`], b[`${k}_earnings`])}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{number(current.total_hours)}</td>
              {previous && (
                <>
                  <td>{number(previous.total_hours)}</td>
                  <td>{number(current.total_hours - previous.total_hours)}</td>
                  <td>{pct(current.total_hours, previous.total_hours)}</td>
                </>
              )}
              <td>{money(current.total_earnings)}</td>
              {previous && (
                <>
                  <td>{money(previous.total_earnings)}</td>
                  <td>
                    {money(current.total_earnings - previous.total_earnings)}
                  </td>
                  <td>
                    {pct(current.total_earnings, previous.total_earnings)}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  )
}
export function Taxes({
  current,
  previous,
}: {
  current: Period
  previous?: Period
}) {
  const groups = [
    {
      title: 'Withholdings',
      fields: [
        'social_security',
        'medicare',
        'fed_income_tax',
        'ct_income_tax',
        'ct_pfl',
        'total_withholdings',
      ],
    },
    {
      title: 'Deductions & net pay',
      fields: [
        'health_deduction',
        'simple_ira',
        'hsa',
        'loan_repayment',
        'other_deduction',
        'total_deductions',
        'reimb_other_payments',
        'net_pay',
      ],
    },
  ]
  const labels: Record<string, string> = {
    social_security: 'Social Security',
    medicare: 'Medicare',
    fed_income_tax: 'Federal income tax',
    ct_income_tax: 'CT income tax',
    ct_pfl: 'CT paid family leave',
    health_deduction: 'Health',
    simple_ira: 'SIMPLE IRA',
    hsa: 'HSA',
    loan_repayment: 'Loan repayment',
    other_deduction: 'Other deductions',
    total_deductions: 'Total deductions',
    total_withholdings: 'Total withholdings',
    reimb_other_payments: 'Reimbursements / other payments',
    net_pay: 'Net pay',
  }
  return (
    <div className="pw-grid-two">
      {groups.map((g) => (
        <Panel
          key={g.title}
          title={g.title}
          action={
            <button
              onClick={() =>
                downloadCSV(g.title + '.csv', [
                  ['Category', 'Current', 'Previous', 'Change'],
                  ...g.fields.map((k) => [
                    labels[k],
                    current.breakdown[k] || 0,
                    previous?.breakdown[k] ?? '',
                    previous
                      ? (current.breakdown[k] || 0) -
                        (previous.breakdown[k] || 0)
                      : '',
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          }
        >
          <div className="pw-scroll">
            <table className="pw-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Current</th>
                  {previous && (
                    <>
                      <th>Previous</th>
                      <th>Change</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {g.fields.map((k) => (
                  <tr key={k}>
                    <td>{labels[k]}</td>
                    <td>{money(current.breakdown[k])}</td>
                    {previous && (
                      <>
                        <td>{money(previous.breakdown[k])}</td>
                        <td>
                          {money(
                            (current.breakdown[k] || 0) -
                              (previous.breakdown[k] || 0),
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  )
}
