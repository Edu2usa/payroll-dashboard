'use client'
import { PageTitle, Panel } from '@/components/PayrollWorkspace'
export default function Settings() {
  return (
    <>
      <PageTitle
        title="Payroll guide"
        description="Understand the numbers and spot changes worth checking."
      />
      <Panel title="From journal to payroll insights">
        <ol className="list-decimal pl-5 space-y-3">
          <li>
            Import a Paychex PDF and inspect the period, employee count and
            totals in the preview.
          </li>
          <li>
            Save the import. A previous version is retained whenever a payroll
            is replaced.
          </li>
          <li>
            Open Discrepancy worth checking to see unusual patterns, compare
            periods, and inspect the contributing employees and source journal.
          </li>
        </ol>
        <p className="mt-3">
          Payrolls naturally vary. Alerts help explain those differences; there
          is no approval checklist or period sign-off.
        </p>
      </Panel>
      <Panel title="What the figures mean">
        <p>
          <strong>Matches journal</strong> means employee categories and totals
          reconcile with the retained source. A discrepancy highlights something
          worth understanding; it is not a declaration that payroll is
          incorrect.
        </p>
        <p className="mt-3">
          New or absent employees describe payroll appearances. First payroll is
          not a hire date. An average hourly earning rate is not necessarily an
          employee's contracted pay rate.
        </p>
      </Panel>
      <Panel title="How unusual patterns are identified">
        <p>
          Double Time is highlighted when it is at least twice the recent
          baseline and at least 8 hours above it. Overtime is highlighted at 50%
          above baseline with at least 40 additional hours. The baseline is the
          median of up to six earlier payrolls of the same length; with fewer
          than three available, the previous comparable payroll is used.
        </p>
        <p className="mt-3">
          An unusually high period remains visible if it happens again, even
          when the previous payroll was also high. As a pattern becomes typical
          in recent history, the baseline adapts.
        </p>
        <p className="mt-3">
          Employee details highlight hours changing over 20%, average regular
          earnings per hour changing over $0.02, overtime or Double Time above
          20 hours and increasing, deduction changes over 10% or
          starting/stopping, and arithmetic mismatches. Ordinary appearances and
          department changes are available under Context only.
        </p>
        <p className="mt-3">
          Earlier imports refresh the comparisons against the correct preceding
          payrolls. Exports contain payroll data and should be stored with your
          payroll records.
        </p>
      </Panel>
    </>
  )
}
