'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  usePayroll,
  PageTitle,
  Panel,
  requestJSON,
} from '@/components/PayrollWorkspace'
import {
  periodLabel,
  dateOnly,
  money,
  number,
  categories,
  categoryLabels,
} from '@/lib/payroll-domain'
import type { ImportPreview } from '@/lib/payroll-import-preview'
type Item = {
  file: File
  preview?: ImportPreview
  error?: string
  saved?: {
    payrollPeriodId: string
    versionId: string
    employeeCount: number
  }
}
const totalRows = [
  ['total_persons', 'Employees', number],
  ['total_hours', 'Total hours', number],
  ['total_earnings', 'Gross pay', money],
  ['total_withholdings', 'Tax withholdings', money],
  ['total_deductions', 'Deductions', money],
  ['total_net_pay', 'Net pay', money],
] as const
function ImportFigures({ preview }: { preview: ImportPreview }) {
  const previous = preview.previous
  const rows = [
    ...totalRows.map(([field, label, format]) => ({
      label,
      format,
      current: preview.totals[field],
      before: previous?.totals[field],
    })),
    ...categories.flatMap((category) => [
      {
        label: categoryLabels[category] + ' hours',
        format: number,
        current: preview.company_breakdown[`${category}_hours`],
        before: previous?.breakdown[`${category}_hours`],
      },
      {
        label: categoryLabels[category] + ' pay',
        format: money,
        current: preview.company_breakdown[`${category}_earnings`],
        before: previous?.breakdown[`${category}_earnings`],
      },
    ]),
  ]
  return (
    <div className="overflow-x-auto my-4">
      <table className="pw-table">
        <caption className="text-left pb-3 font-semibold">
          {previous
            ? 'Saved payroll → this PDF'
            : 'Figures extracted from this PDF'}
        </caption>
        <thead>
          <tr>
            <th scope="col">Payroll figure</th>
            {previous && <th scope="col">Currently saved</th>}
            <th scope="col">This PDF</th>
            {previous && <th scope="col">Change</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, format, current, before }) => {
            const difference = current - (before || 0)
            const changed = Math.abs(difference) > 0.0001
            return (
              <tr key={label}>
                <td>{label}</td>
                {previous && <td>{format(before)}</td>}
                <td className="font-semibold">{format(current)}</td>
                {previous && (
                  <td>
                    {changed
                      ? `${difference > 0 ? '+' : ''}${format(difference)}`
                      : 'No change'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
export default function Imports() {
  const { refresh } = usePayroll(),
    [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    router = useRouter()
  async function imports(files: File[]) {
    setBusy(true)
    const next: Item[] = files.map((file) => ({ file }))
    setItems(next)
    let latestPeriodId = ''
    for (let i = 0; i < files.length; i++) {
      try {
        const previewForm = new FormData()
        previewForm.set('file', files[i])
        previewForm.set('mode', 'preview')
        const preview = await requestJSON('/api/upload', {
          method: 'POST',
          body: previewForm,
        })
        next[i] = { file: files[i], preview }
        setItems([...next])
        const saveForm = new FormData()
        saveForm.set('file', files[i])
        saveForm.set('actor', 'Dashboard import')
        saveForm.set('hash', preview.hash)
        saveForm.set('expectedVersion', preview.expectedVersion || '')
        const result = await requestJSON('/api/upload', {
          method: 'POST',
          body: saveForm,
        })
        latestPeriodId = result.payrollPeriodId
        next[i] = {
          file: files[i],
          preview,
          saved: result,
        }
      } catch (e) {
        next[i] = { file: files[i], error: (e as Error).message }
      }
      setItems([...next])
    }
    setBusy(false)
    if (latestPeriodId) {
      await refresh()
      router.push('/dashboard?period=' + latestPeriodId + '&imported=1')
    }
  }
  return (
    <>
      <PageTitle
        title="Import payroll journals"
        description="Choose a complete Paychex journal and it will be checked, saved, and opened on the Dashboard."
      />
      <Panel
        title="Choose Paychex PDFs"
        description="Use the complete payroll journal with all employees and company totals, up to 4 MB per PDF."
      >
        <p className="mb-4">
          Choose the complete Paychex journal. The app checks the figures,
          saves it to the database, and opens the Dashboard automatically.
          Matching start and end dates safely replace that period; a different
          date range creates a new period. Do not use a supplement containing
          only corrections.
        </p>
        <label>
          Journal files
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            disabled={busy}
            onChange={(e) => imports(Array.from(e.target.files || []))}
          />
        </label>
        <p className="mt-3">
          Valid imports are recorded as Dashboard import. Source text and every
          saved version are retained. Keep the original PDFs with your payroll
          records.
        </p>
      </Panel>
      {busy && (
        <p role="status" className="pw-empty">
          Checking and importing journal…
        </p>
      )}
      {items.map((item, i) => (
        <Panel key={i} title={item.file.name}>
          {item.error && (
            <div className="pw-error" role="alert">
              {item.error}
              <button
                disabled={busy}
                onClick={() => imports(items.map((v) => v.file))}
              >
                Preview files again
              </button>
            </div>
          )}
          {item.preview && (
            <>
              <p>
                {periodLabel(item.preview)} · Check date{' '}
                {dateOnly(item.preview.check_date)}
              </p>
              <div className="pw-actions my-4">
                <span className="pw-badge ok">
                  ✓ Employee totals match the journal
                </span>
                <span className="pw-badge">
                  {item.preview.previous
                    ? 'Replaces this period'
                    : 'New payroll period'}
                </span>
              </div>
              <ImportFigures preview={item.preview} />
              <p className="mb-4">
                {item.preview.previous
                  ? 'This import replaces all employee entries for these dates. Amounts are not added to the existing payroll. Each import keeps a version in History.'
                  : 'No payroll with these start and end dates was saved yet. This import creates one new payroll period.'}
              </p>
              {item.preview.previous && (
                <p className="mb-4">
                  Employees added: {item.preview.previous.addedEmployees}.
                  Employees removed: {item.preview.previous.removedEmployees}.
                  {item.preview.previous.check_date !==
                    item.preview.check_date && (
                    <>
                      {' '}
                      Check date changes from{' '}
                      {dateOnly(item.preview.previous.check_date)} to{' '}
                      {dateOnly(item.preview.check_date)}.
                    </>
                  )}
                </p>
              )}
              {!!item.preview.previous?.removedEmployees && (
                <p className="pw-error mb-4">
                  This PDF omits {item.preview.previous.removedEmployees}{' '}
                  employee(s) in the saved version. Their entries will be
                  removed from this period. Make sure this is the complete
                  corrected journal.
                </p>
              )}
              {item.saved ? (
                <div className="pw-actions" role="status">
                  <span className="pw-badge ok">✓ Saved and recorded</span>
                  <span>
                    {item.preview.previous
                      ? 'This corrected the saved payroll for these dates; it was not added a second time.'
                      : 'This is now a saved payroll period.'}
                  </span>
                  <span>{item.saved.employeeCount} employees recorded</span>
                  <Link
                    className="pw-button"
                    href={'/source/' + item.saved.payrollPeriodId}
                    onClick={() => refresh()}
                  >
                    View saved payroll
                  </Link>
                  <Link
                    className="pw-button"
                    href={'/comparison?current=' + item.saved.payrollPeriodId}
                  >
                    Compare with another payroll
                  </Link>
                  <Link className="pw-button" href="/history">
                    View import history
                  </Link>
                  <button onClick={refresh}>Refresh workspace</button>
                </div>
              ) : null}
            </>
          )}
        </Panel>
      ))}
      <Panel title="Restore a previous import">
        <p>
          Open History, inspect a saved version and choose Restore. The
          replacement happens as one complete save, and your current version
          stays in history.
        </p>
        <Link className="pw-button mt-4" href="/history">
          Open import history
        </Link>
      </Panel>
    </>
  )
}
