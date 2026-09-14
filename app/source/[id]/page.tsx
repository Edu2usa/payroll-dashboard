'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  usePayroll,
  PageTitle,
  Panel,
  requestJSON,
  ErrorBox,
  downloadCSV,
} from '@/components/PayrollWorkspace'
import { PeriodStatus } from '@/components/PayrollPanels'
import {
  categories,
  categoryLabels,
  periodLabel,
  dateOnly,
  journalContext,
  money,
  number,
} from '@/lib/payroll-domain'
function Source({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams(),
    query = searchParams.toString()
  const { data, name } = usePayroll(),
    period = data.periods.find((p) => p.id === params.id)
  const [source, setSource] = useState<string | null>(null),
    [error, setError] = useState(''),
    [category, setCategory] = useState('double_time'),
    [employeeId, setEmployeeId] = useState(''),
    [full, setFull] = useState(false),
    [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const q = new URLSearchParams(query)
    setCategory(q.get('category') || 'double_time')
    setEmployeeId(q.get('employee') || '')
  }, [params.id, query])
  useEffect(() => {
    const abort = new AbortController()
    setSource(null)
    setError('')
    requestJSON('/api/payroll-periods/' + params.id, { signal: abort.signal })
      .then((d) => {
        if (d.active_version_id !== period?.active_version_id)
          throw new Error(
            'This payroll changed. Refresh the workspace before viewing its source.',
          )
        setSource(d.raw_text || '')
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message)
      })
    return () => abort.abort()
  }, [params.id, attempt, period?.active_version_id])
  if (!period)
    return (
      <PageTitle
        title="Journal not found"
        description="Choose an imported payroll in History."
      />
    )
  const key = categories.includes(category as any)
    ? (category as (typeof categories)[number])
    : 'double_time'
  const entries = data.entries.filter(
    (e) =>
      e.payroll_period_id === params.id &&
      (employeeId
        ? e.employee_id === employeeId
        : e[`${key}_hours`] > 0 || e[`${key}_earnings`] !== 0),
  )
  const employee = data.employees.find((e) => e.id === employeeId)
  const context = employee
    ? journalContext(source || '', employee.employee_id)
    : null
  const excerpt = !full && context ? context : source
  return (
    <>
      <PageTitle
        title="Source journal"
        description={
          periodLabel(period) + ' · Check date ' + dateOnly(period.check_date)
        }
      />
      <PeriodStatus period={period} />
      <Panel
        title="Employees behind the total"
        description="Average $/h is reported category earnings divided by hours. Inspect the journal for individual rates and salary earning lines."
        action={
          <button
            onClick={() =>
              downloadCSV('journal-contributors.csv', [
                [
                  'Employee',
                  'Category',
                  'Hours',
                  'Average earnings per hour',
                  'Earnings',
                ],
                ...entries.flatMap((e) =>
                  (employeeId ? categories : [key]).map((k) => [
                    name(e.employee_id),
                    categoryLabels[k],
                    e[`${k}_hours`],
                    e[`${k}_hours`] > 0
                      ? e[`${k}_earnings`] / e[`${k}_hours`]
                      : '',
                    e[`${k}_earnings`],
                  ]),
                ),
              ])
            }
          >
            Export CSV
          </button>
        }
      >
        <div className="pw-toolbar">
          <label>
            Pay category
            <select
              value={key}
              onChange={(e) => {
                setCategory(e.target.value)
                setEmployeeId('')
              }}
            >
              {categories.map((k) => (
                <option key={k} value={k}>
                  {categoryLabels[k]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Employee
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">All contributors</option>
              {data.employees
                .filter((e) =>
                  data.entries.some(
                    (r) =>
                      r.payroll_period_id === params.id &&
                      r.employee_id === e.id,
                  ),
                )
                .sort((a, b) => name(a.id).localeCompare(name(b.id)))
                .map((e) => (
                  <option value={e.id} key={e.id}>
                    {name(e.id)}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="pw-scroll">
          <table className="pw-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Category</th>
                <th>Hours</th>
                <th>Average $/h</th>
                <th>Earnings</th>
                <th>Journal</th>
              </tr>
            </thead>
            <tbody>
              {entries.flatMap((e) =>
                (employeeId ? categories : [key]).map((k) => (
                  <tr key={e.id + k}>
                    <td>
                      <Link href={'/employees/' + e.employee_id}>
                        {name(e.employee_id)}
                      </Link>
                    </td>
                    <td>{categoryLabels[k]}</td>
                    <td>{number(e[`${k}_hours`])}</td>
                    <td>
                      {e[`${k}_hours`] > 0
                        ? money(e[`${k}_earnings`] / e[`${k}_hours`])
                        : '—'}
                    </td>
                    <td>{money(e[`${k}_earnings`])}</td>
                    <td>
                      <button
                        className="pw-link"
                        onClick={() => {
                          setEmployeeId(e.employee_id)
                          setFull(false)
                        }}
                      >
                        Show extract
                      </button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
            {!employeeId && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{categoryLabels[key]}</td>
                  <td>
                    {number(entries.reduce((n, e) => n + e[`${key}_hours`], 0))}
                  </td>
                  <td>—</td>
                  <td>
                    {money(
                      entries.reduce((n, e) => n + e[`${key}_earnings`], 0),
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {!entries.length && (
          <p className="pw-empty">No contributing entries in this selection.</p>
        )}
      </Panel>
      <Panel
        title={
          employee && !full && context
            ? 'Journal context for employee #' + employee.employee_id
            : 'Retained journal text'
        }
        description="Text retained from the uploaded PDF. The original PDF file is not stored here. Context may include neighboring employee lines."
        action={
          <button onClick={() => setFull(!full)}>
            {full ? 'Show employee context' : 'Show full journal'}
          </button>
        }
      >
        {error ? (
          <ErrorBox message={error} retry={() => setAttempt((n) => n + 1)} />
        ) : source === null ? (
          <p role="status">Loading source…</p>
        ) : source ? (
          <pre className="pw-source">{excerpt}</pre>
        ) : (
          <p className="pw-empty">
            No journal text was retained for this payroll.
          </p>
        )}
      </Panel>
    </>
  )
}
export default function SourcePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<p>Loading journal…</p>}>
      <Source params={params} />
    </Suspense>
  )
}
