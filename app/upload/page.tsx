'use client'
import { useState } from 'react'
import Link from 'next/link'
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
    [actor, setActor] = useState(''),
    [busy, setBusy] = useState(false)
  async function previews(files: File[]) {
    setBusy(true)
    const next: Item[] = files.map((file) => ({ file }))
    setItems(next)
    for (let i = 0; i < files.length; i++) {
      const form = new FormData()
      form.set('file', files[i])
      form.set('mode', 'preview')
      try {
        next[i] = {
          file: files[i],
          preview: await requestJSON('/api/upload', {
            method: 'POST',
            body: form,
          }),
        }
      } catch (e) {
        next[i] = { file: files[i], error: (e as Error).message }
      }
      setItems([...next])
    }
    setBusy(false)
  }
  async function save(index: number) {
    const item = items[index]
    if (!item.preview) return
    setBusy(true)
    const form = new FormData()
    form.set('file', item.file)
    form.set('actor', actor)
    form.set('hash', item.preview.hash)
    form.set('expectedVersion', item.preview.expectedVersion || '')
    try {
      const result = await requestJSON('/api/upload', {
        method: 'POST',
        body: form,
      })
      setItems((old) =>
        old.map((v, i) =>
          i === index
            ? { ...v, saved: result, error: undefined }
            : v,
        ),
      )
      await refresh()
    } catch (e) {
      setItems((old) =>
        old.map((v, i) =>
          i === index ? { ...v, error: (e as Error).message } : v,
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <PageTitle
        title="Import payroll journals"
        description="Import a new payroll or replace an existing period with a corrected Paychex journal."
      />
      <Panel
        title="Choose Paychex PDFs"
        description="Use the complete payroll journal with all employees and company totals, up to 4 MB per PDF."
      >
        <p className="mb-4">
          Correct payroll in Paychex, generate the complete PDF again, and
          select it here. Matching start and end dates replace that period; a
          different date range creates a new period. The filename does not
          control this. Do not use a supplement containing only the corrections.
        </p>
        <label>
          Journal files
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            disabled={busy}
            onChange={(e) => previews(Array.from(e.target.files || []))}
          />
        </label>
        <label className="mt-4">
          Your name
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            maxLength={120}
            placeholder="Recorded with the import"
          />
        </label>
        <p className="mt-3">
          Names are entered by the importer under the shared login. Source text
          and every saved version are retained. Keep the original PDFs with your
          payroll records.
        </p>
      </Panel>
      {busy && (
        <p role="status" className="pw-empty">
          Checking or saving journal…
        </p>
      )}
      {items.map((item, i) => (
        <Panel key={i} title={item.file.name}>
          {item.error && (
            <div className="pw-error" role="alert">
              {item.error}
              <button
                disabled={busy}
                onClick={() => previews(items.map((v) => v.file))}
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
                  ? 'Saving replaces all employee entries for these dates. Amounts are not added to the existing payroll. Even the same PDF can be saved again without doubling totals; each save keeps a version in History.'
                  : 'No payroll with these start and end dates is saved yet. Saving creates one new payroll period.'}
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
              ) : (
                <button
                  className="pw-primary"
                  disabled={busy || !actor.trim()}
                  onClick={() => save(i)}
                >
                  {item.preview.expectedVersion
                    ? 'Save replacement version'
                    : 'Save payroll'}
                </button>
              )}
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
