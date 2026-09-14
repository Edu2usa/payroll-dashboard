'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  usePayroll,
  PageTitle,
  Panel,
  requestJSON,
} from '@/components/PayrollWorkspace'
import { periodLabel, dateOnly, money, number } from '@/lib/payroll-domain'
type Item = { file: File; preview?: any; error?: string; saved?: string }
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
            ? { ...v, saved: result.payrollPeriodId, error: undefined }
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
        description="Preview the source, check the figures, then save a complete payroll version."
      />
      <Panel
        title="Choose Paychex PDFs"
        description="Select one or more PDF journals, up to 4 MB each. Each file is checked before it can replace existing figures."
      >
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
              <div className="pw-metrics mt-4">
                {[
                  ['Employees', item.preview.totals.total_persons],
                  ['Hours', number(item.preview.totals.total_hours)],
                  ['Gross', money(item.preview.totals.total_earnings)],
                  ['Net', money(item.preview.totals.total_net_pay)],
                ].map(([label, value]) => (
                  <div className="pw-metric" key={label}>
                    <span className="pw-label">{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <p className="mb-4">
                {item.preview.expectedVersion
                  ? 'This will replace the current payroll of ' +
                    money(item.preview.previousGross) +
                    '. Its previous version will remain available in History.'
                  : 'This creates a new payroll period.'}
              </p>
              {item.saved ? (
                <div className="pw-actions">
                  <span className="pw-badge ok">✓ Saved successfully</span>
                  <Link
                    className="pw-button"
                    href={'/source/' + item.saved}
                    onClick={() => refresh()}
                  >
                    View saved payroll
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
