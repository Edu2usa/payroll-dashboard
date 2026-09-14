'use client'
import { useState } from 'react'
import { usePayroll, PageTitle, Panel } from '@/components/PayrollWorkspace'
import {
  Summary,
  Changes,
  Breakdown,
  Taxes,
  PeriodStatus,
} from '@/components/PayrollPanels'
import {
  previousPeriod,
  periodLabel,
  money,
  dateOnly,
} from '@/lib/payroll-domain'
export default function Comparison() {
  const { data, period } = usePayroll(),
    [previousId, setPreviousId] = useState('')
  if (!period)
    return (
      <PageTitle
        title="Compare payrolls"
        description="Import at least two journals to compare periods."
      />
    )
  const previous =
    data.periods.find((p) => p.id === previousId) ||
    previousPeriod(period, data.periods)
  return (
    <>
      <PageTitle
        title="Compare payrolls"
        description="Explain the change in hours, earnings, deductions and take-home pay."
      />
      <div className="pw-toolbar">
        <label>
          Compare selected payroll to
          <select
            value={previous?.id || ''}
            onChange={(e) => setPreviousId(e.target.value)}
          >
            <option value="">Choose a period</option>
            {data.periods.map((p) => (
              <option key={p.id} value={p.id}>
                {periodLabel(p)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!previous ? (
        <p className="pw-empty">Choose another imported payroll to compare.</p>
      ) : previous.id === period.id ? (
        <div className="pw-error" role="status">
          Choose two different payroll periods. No comparison is shown for the
          same period.
        </div>
      ) : (
        <>
          <Summary period={period} />
          <Panel
            title="Comparison period"
            description={
              periodLabel(previous) +
              ' · Check date ' +
              dateOnly(previous.check_date)
            }
          >
            <PeriodStatus period={previous} />
            <div className="pw-actions">
              <strong>Gross {money(previous.total_earnings)}</strong>
              <span>Net {money(previous.total_net_pay)}</span>
              <span>{previous.total_persons} employees</span>
            </div>
          </Panel>
          <Changes current={period} previous={previous} />
          <Breakdown current={period} previous={previous} />
          <Taxes current={period} previous={previous} />
        </>
      )}
    </>
  )
}
