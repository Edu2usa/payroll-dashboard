'use client'
import { useState } from 'react'
import {
  usePayroll,
  PageTitle,
  Panel,
  downloadCSV,
} from '@/components/PayrollWorkspace'
import { Summary, ReviewList, ReviewForm } from '@/components/PayrollPanels'
export default function Review() {
  const { data, period, name } = usePayroll(),
    [status, setStatus] = useState('open'),
    [severity, setSeverity] = useState(''),
    [search, setSearch] = useState(''),
    [periodReview, setPeriodReview] = useState(false)
  if (!period)
    return (
      <PageTitle
        title="Review payroll"
        description="Import a journal to begin."
      />
    )
  const alerts = data.alerts.filter(
    (a) =>
      a.current_period_id === period.id &&
      (status === 'all' || a.is_reviewed === (status === 'reviewed')) &&
      (!severity || a.severity === severity) &&
      (name(a.employee_id) + ' ' + a.notes)
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  return (
    <>
      <PageTitle
        title="Review payroll"
        description="A change is a prompt to investigate. Check the evidence and record what you found."
      />
      <Summary period={period} />
      <Panel
        title="Review queue"
        action={
          <button
            onClick={() =>
              downloadCSV('payroll-review.csv', [
                [
                  'Employee',
                  'Priority',
                  'Field',
                  'Reason',
                  'Previous',
                  'Current',
                  'Change',
                  'Reviewed',
                  'Reviewer',
                  'Review note',
                ],
                ...alerts.map((a) => [
                  name(a.employee_id),
                  a.severity,
                  a.field,
                  a.notes,
                  a.previous_value,
                  a.current_value,
                  a.difference,
                  a.is_reviewed,
                  a.reviewed_by,
                  a.review_note,
                ]),
              ])
            }
          >
            Export CSV
          </button>
        }
      >
        <div className="pw-toolbar">
          <label>
            Find employee or reason
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search review items"
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Needs review</option>
              <option value="reviewed">Reviewed</option>
              <option value="all">All items</option>
            </select>
          </label>
          <label>
            Priority
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Review</option>
              <option value="info">Information</option>
            </select>
          </label>
        </div>
        <ReviewList alerts={alerts} />
      </Panel>
      <Panel
        title="Complete this period"
        description="This records a separate review of the current payroll version. All journal checks and review items must be complete."
      >
        <button
          disabled={
            !period.reviewed &&
            (period.open_alerts > 0 || !period.reconciliation.matches)
          }
          onClick={() => setPeriodReview(true)}
        >
          {period.reviewed ? 'Reopen period review' : 'Record period review'}
        </button>
        {periodReview && (
          <ReviewForm
            id={period.review_id}
            reviewed={period.reviewed}
            onCancel={() => setPeriodReview(false)}
          />
        )}
      </Panel>
    </>
  )
}
