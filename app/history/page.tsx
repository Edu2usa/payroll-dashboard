'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  usePayroll,
  PageTitle,
  Panel,
  downloadCSV,
  requestJSON,
} from '@/components/PayrollWorkspace'
import {
  periodLabel,
  dateOnly,
  dateTime,
  money,
  number,
} from '@/lib/payroll-domain'
export default function History() {
  const { data, setPeriod, refresh, name } = usePayroll(),
    [search, setSearch] = useState(''),
    [version, setVersion] = useState<any>(null),
    [actor, setActor] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const rows = data.periods.filter((p) =>
    (periodLabel(p) + ' ' + p.check_date)
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  async function preview(id: string) {
    setBusy(true)
    setError('')
    try {
      setVersion(await requestJSON('/api/import-versions/' + id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function restore() {
    setBusy(true)
    setError('')
    try {
      const active = data.periods.find(
        (p) => p.id === version.payroll_period_id,
      )
      await requestJSON('/api/import-versions/' + version.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor,
          expectedVersion: active?.active_version_id,
        }),
      })
      setVersion(null)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title="Payroll history"
        description="Every imported payroll, its source, saved versions and review history."
      />
      <Panel
        title="Imported payrolls"
        action={
          <button
            onClick={() =>
              downloadCSV('payroll-history.csv', [
                [
                  'Period start',
                  'Period end',
                  'Check date',
                  'Employees',
                  'Hours',
                  'Gross',
                  'Net',
                  'Journal matches',
                  'Reviewed',
                  'Open review items',
                ],
                ...rows.map((p) => [
                  p.period_start,
                  p.period_end,
                  p.check_date,
                  p.total_persons,
                  p.total_hours,
                  p.total_earnings,
                  p.total_net_pay,
                  p.reconciliation.matches,
                  p.reviewed,
                  p.open_alerts,
                ]),
              ])
            }
          >
            Export CSV
          </button>
        }
      >
        <label className="pw-toolbar">
          Find pay period
          <input
            placeholder="Date or month"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="pw-scroll">
          <table className="pw-table">
            <thead>
              <tr>
                <th>Pay period</th>
                <th>Check date</th>
                <th>Employees</th>
                <th>Hours</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Journal</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href="/dashboard" onClick={() => setPeriod(p.id)}>
                      {periodLabel(p)}
                    </Link>
                  </td>
                  <td>{dateOnly(p.check_date)}</td>
                  <td>{p.total_persons}</td>
                  <td>{number(p.total_hours)}</td>
                  <td>{money(p.total_earnings)}</td>
                  <td>{money(p.total_net_pay)}</td>
                  <td>
                    <Link href={'/source/' + p.id}>
                      {p.reconciliation.matches ? 'Matches' : 'Check source'}
                    </Link>
                  </td>
                  <td>
                    <Link href="/review" onClick={() => setPeriod(p.id)}>
                      {p.reviewed ? 'Reviewed' : p.open_alerts + ' open'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {error && (
        <div className="pw-error" role="alert">
          {error}
        </div>
      )}
      {version && (
        <Panel
          title="Version preview"
          description={
            dateTime(version.created_at) +
            ' · ' +
            version.source_name +
            ' · ' +
            version.actor
          }
        >
          <div className="pw-statuses">
            <span className="pw-badge">{periodLabel(version.payload)}</span>
            <span className="pw-badge">
              Gross {money(version.payload.totals.total_earnings)}
            </span>
            <span className="pw-badge">
              Net {money(version.payload.totals.total_net_pay)}
            </span>
            <span className="pw-badge">
              {version.payload.totals.total_persons} employees
            </span>
          </div>
          <details>
            <summary>View retained journal for this version</summary>
            <pre className="pw-source">{version.payload.raw_text}</pre>
          </details>
          {data.periods.find((p) => p.id === version.payroll_period_id)
            ?.active_version_id !== version.id && (
            <>
              <p className="my-4">
                Restore this version’s figures for the displayed period. The
                current figures remain available as a saved version. Review
                status will reset for the restored payroll and comparisons
                affected by it.
              </p>
              <label>
                Your name
                <input
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  maxLength={120}
                />
              </label>
              <button
                className="pw-primary mt-4"
                disabled={!actor.trim() || busy}
                onClick={restore}
              >
                {busy ? 'Restoring…' : 'Restore this version'}
              </button>
            </>
          )}
          <button className="ml-3 mt-4" onClick={() => setVersion(null)}>
            Close preview
          </button>
        </Panel>
      )}
      <Panel
        title="Import versions"
        description="Baseline versions preserve the reconciled journals already present when version history was enabled. Earlier uploads did not record an uploader."
      >
        <div className="pw-scroll">
          <table className="pw-table">
            <thead>
              <tr>
                <th>Pay period</th>
                <th>Recorded</th>
                <th className="pw-text">Source</th>
                <th className="pw-text">Entered by</th>
                <th>Version</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {[...data.versions]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((v) => {
                  const p = data.periods.find(
                    (p) => p.id === v.payroll_period_id,
                  )
                  return (
                    <tr key={v.id}>
                      <td>{p ? periodLabel(p) : 'Unavailable'}</td>
                      <td>{dateTime(v.created_at)}</td>
                      <td className="pw-text">{v.source_name}</td>
                      <td className="pw-text">{v.actor}</td>
                      <td>
                        {v.id === p?.active_version_id
                          ? 'Current'
                          : v.reason.startsWith('restore')
                            ? 'Restored'
                            : 'Saved'}
                      </td>
                      <td>
                        <button disabled={busy} onClick={() => preview(v.id)}>
                          Inspect version
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Review history"
        description="Review actions are retained even after the payroll version changes."
        action={
          <button
            onClick={() =>
              downloadCSV('review-history.csv', [
                ['Date', 'Reviewer', 'Action', 'Note'],
                ...data.events.map((e) => [
                  e.created_at,
                  e.actor,
                  e.is_reviewed ? 'Reviewed' : 'Reopened',
                  e.note,
                ]),
              ])
            }
          >
            Export CSV
          </button>
        }
      >
        {data.events.length ? (
          <div className="pw-scroll">
            <table className="pw-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Recorded</th>
                  <th>Reviewer</th>
                  <th>Action</th>
                  <th className="pw-text">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.alert?.employee_id
                        ? name(e.alert.employee_id)
                        : 'Period review'}
                    </td>
                    <td>{dateTime(e.created_at)}</td>
                    <td>{e.actor}</td>
                    <td>{e.is_reviewed ? 'Reviewed' : 'Reopened'}</td>
                    <td className="pw-text">{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pw-empty">No review actions have been recorded yet.</p>
        )}
      </Panel>
    </>
  )
}
