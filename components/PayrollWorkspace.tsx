'use client'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { dateOnly, dateTime, periodLabel, csvText } from '@/lib/payroll-domain'
import type { PayrollEntry, PayrollPeriod, Employee } from '@/lib/supabase'
import type { PayrollAlert } from '@/lib/payroll-alerts'
import './payroll-workspace.css'

export type Period = PayrollPeriod & {
  active_version_id: string
  breakdown: Record<string, number>
  reconciliation: { matches: boolean; issues: string[] }
  open_alerts: number
  reviewed: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  review_id: string
  source_available: boolean
}
export type Alert = PayrollAlert & {
  id: string
  is_reviewed: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string
}
export type WorkspaceData = {
  periods: Period[]
  entries: PayrollEntry[]
  employees: Employee[]
  alerts: Alert[]
  versions: any[]
  events: any[]
}
type Context = {
  data: WorkspaceData
  period: Period | null
  setPeriod: (id: string) => void
  refresh: () => Promise<void>
  name: (id: string) => string
}
const PayrollContext = createContext<Context | null>(null)
export function usePayroll() {
  const value = useContext(PayrollContext)
  if (!value) throw new Error('Payroll workspace unavailable')
  return value
}
export function downloadCSV(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(
      new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }),
    ),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export async function requestJSON(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const data = await response.json()
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Your session has ended. Sign in to continue.'
        : data.error || 'Could not complete this request.',
    )
  return data
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string
  retry?: () => void
}) {
  return (
    <div className="pw-error" role="alert">
      <strong>{message}</strong>
      {retry && <button onClick={retry}>Try again</button>}
      <Link href="/">Sign in</Link>
    </div>
  )
}
function Provider({ children }: { children: React.ReactNode }) {
  const activeRequest = useRef<AbortController | null>(null)
  const [data, setData] = useState<WorkspaceData | null>(null),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    setLoading(true)
    setError('')
    try {
      const result = await requestJSON('/api/workspace', {
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setData(result)
    } catch (e) {
      if (!controller.signal.aborted) {
        setError((e as Error).message)
        setData(null)
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])
  useEffect(() => {
    refresh()
    return () => activeRequest.current?.abort()
  }, [refresh])
  const period =
    data?.periods.find((p) => p.id === selected) || data?.periods[0] || null
  return (
    <div className="payroll-workspace">
      <a className="pw-skip" href="#payroll-main">
        Skip to payroll
      </a>
      <Sidebar />
      <div className="pw-main">
        <header className="pw-header">
          <span>
            Preferred Maintenance <span className="pw-muted">/ Payroll</span>
          </span>
          <div className="pw-actions">
            <button onClick={refresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link className="pw-button pw-primary" href="/upload">
              Import journal
            </Link>
          </div>
        </header>
        <main id="payroll-main">
          {loading && !data ? (
            <div className="pw-panel" role="status">
              Loading payroll…
            </div>
          ) : error ? (
            <ErrorBox message={error} retry={refresh} />
          ) : (
            data && (
              <PayrollContext.Provider
                value={{
                  data,
                  period,
                  setPeriod: setSelected,
                  refresh,
                  name: (id) => {
                    const e = data.employees.find((e) => e.id === id)
                    return e
                      ? `${e.last_name}, ${e.first_name}`
                      : 'Employee unavailable'
                  },
                }}
              >
                {period && (
                  <div className="pw-period-bar">
                    <label>
                      Pay period
                      <select
                        value={period.id}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        {data.periods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {periodLabel(p)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="pw-label">Check date</span>
                      <strong>{dateOnly(period.check_date)}</strong>
                    </div>
                    <div>
                      <span className="pw-label">Version recorded</span>
                      <span>
                        {dateTime(
                          data.versions.find(
                            (v) => v.id === period.active_version_id,
                          )?.created_at || period.created_at,
                        )}
                      </span>
                    </div>
                    <Link className="pw-button" href={`/source/${period.id}`}>
                      View source journal ↗
                    </Link>
                  </div>
                )}
                {children}
              </PayrollContext.Provider>
            )
          )}
        </main>
        <footer className="pw-footer">
          Preferred Maintenance · Payroll review workspace
        </footer>
      </div>
    </div>
  )
}
export function PayrollWorkspace({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return path === '/' ? <>{children}</> : <Provider>{children}</Provider>
}
export function PageTitle({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="pw-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  )
}
export function Panel({
  title,
  description,
  children,
  action,
}: {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="pw-panel">
      <div className="pw-panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
