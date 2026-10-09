'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePayroll, PageTitle, Panel } from '@/components/PayrollWorkspace'
import {
  Summary,
  Changes,
  Breakdown,
  Taxes,
  PeriodStatus,
} from '@/components/PayrollPanels'
import {
  comparisonPeriods,
  periodLabel,
  money,
  dateOnly,
} from '@/lib/payroll-domain'
export default function Comparison() {
  const { data, period } = usePayroll(),
    [previousId, setPreviousId] = useState(''),
    searchParams = useSearchParams()
  if (!period)
    return (
      <PageTitle
        title="Compare payrolls"
        description="Import at least two journals to compare periods."
      />
    )
  const current =
    data.periods.find((p) => p.id === searchParams.get('current')) || period
  const choices = comparisonPeriods(current, data.periods)
  const previous =
    choices.find((p) => p.id === previousId) ||
    choices.find((p) => p.id === searchParams.get('previous')) ||
    choices.find((p) => p.period_end < current.period_end) ||
    choices[0] ||
    null
  return (
    <>
      <PageTitle
        title="Compare payrolls"
        description="Compare the selected payroll with a different saved pay period."
      />
      <div className="pw-toolbar">
        <label>
          Reviewing {periodLabel(current)}. Compare it to
          <select
            value={previous?.id || ''}
            onChange={(e) => setPreviousId(e.target.value)}
          >
            <option value="">Choose a period</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {periodLabel(p)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!previous ? (
        <p className="pw-empty">
          This payroll is saved, but there is not another pay period to compare
          yet. Import a different date range, then return here.
        </p>
      ) : (
        <>
          <Summary period={current} />
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
          <Changes current={current} previous={previous} />
          <Breakdown current={current} previous={previous} />
          <Taxes current={current} previous={previous} />
        </>
      )}
    </>
  )
}
