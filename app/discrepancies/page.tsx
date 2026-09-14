'use client'
import { useState } from 'react'
import {
  usePayroll,
  PageTitle,
  Panel,
  downloadCSV,
} from '@/components/PayrollWorkspace'
import { Summary, DiscrepancyList } from '@/components/PayrollPanels'
import { PayrollSignals } from '@/components/PayrollSignals'
export default function Discrepancies() {
  const { data, period, name } = usePayroll()
  const [severity, setSeverity] = useState('worth-checking')
  const [search, setSearch] = useState('')
  if (!period)
    return (
      <PageTitle
        title="Discrepancy worth checking"
        description="Import a journal to see unusual payroll changes."
      />
    )
  const alerts = data.alerts.filter(
    (a) =>
      a.current_period_id === period.id &&
      (severity === 'all' ||
        (severity === 'worth-checking'
          ? a.severity !== 'info'
          : a.severity === severity)) &&
      (name(a.employee_id) + ' ' + a.notes)
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  return (
    <>
      <PageTitle
        title="Discrepancy worth checking"
        description="Payrolls naturally differ. Focus on unusual changes and the evidence that explains them. No approval or sign-off is required."
      />
      <Summary period={period} />
      <PayrollSignals period={period} />
      <Panel
        title="Employee discrepancies"
        description="These changes may be expected. Compare the sources to understand the reason."
        action={
          <button
            onClick={() =>
              downloadCSV('payroll-discrepancies.csv', [
                [
                  'Employee',
                  'Priority',
                  'Field',
                  'Reason',
                  'Previous',
                  'Current',
                  'Change',
                ],
                ...alerts.map((a) => [
                  name(a.employee_id),
                  a.severity,
                  a.field,
                  a.notes,
                  a.previous_value,
                  a.current_value,
                  a.difference,
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
              placeholder="Search discrepancies"
            />
          </label>
          <label>
            Show
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="worth-checking">Worth checking</option>
              <option value="high">High priority</option>
              <option value="info">Context only</option>
              <option value="all">All changes</option>
            </select>
          </label>
        </div>
        <DiscrepancyList alerts={alerts} />
      </Panel>
    </>
  )
}
