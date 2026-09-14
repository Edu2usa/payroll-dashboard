'use client'
import { PageTitle, Panel } from '@/components/PayrollWorkspace'
export default function Settings() {
  return (
    <>
      <PageTitle
        title="Payroll guide"
        description="How to use this workspace and interpret its review status."
      />
      <Panel title="From journal to completed review">
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
            Open Review, inspect the journal evidence, and record why each
            flagged change is expected or needs follow-up.
          </li>
          <li>
            After the figures match the journal and all items are reviewed,
            record the period review.
          </li>
        </ol>
      </Panel>
      <Panel title="What the status means">
        <p>
          <strong>Matches journal</strong> means employee categories and totals
          reconcile with the retained source. It does not establish that
          underlying wages, deductions or taxes were calculated correctly.
        </p>
        <p className="mt-3">
          <strong>Reviewed by a person</strong> records an explicit review of
          the current version. Names are entered by the reviewer under the
          shared login.
        </p>
        <p className="mt-3">
          New or absent employees describe payroll appearances. First payroll is
          not a hire date. An average hourly earning rate is not necessarily an
          employee’s contracted pay rate.
        </p>
      </Panel>
      <Panel title="Review rules">
        <p>
          Hours changing more than 20%; average regular earnings per hour
          changing more than $0.02; overtime or Double Time above 20 hours and
          increasing; deductions changing over 10%, starting or stopping; new or
          absent employees; and category or net-pay mismatches are shown for
          review.
        </p>
        <p className="mt-3">
          Imports of earlier payrolls automatically refresh the comparisons
          against their chronological predecessors. A changed import version
          requires a fresh review. Exported files contain payroll data and
          should be stored with your payroll records.
        </p>
      </Panel>
    </>
  )
}
