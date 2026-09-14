import { createHash } from 'crypto'
import {
  supabaseServer,
  PayrollEntry,
  PayrollPeriod,
  Employee,
} from './supabase'
import { aggregate, previousPeriod } from './payroll-domain'
import { buildAlerts } from './payroll-alerts'
import { extractCompanyBreakdownFromText } from './pdf-parser'

export async function readAll(table: string, select = '*') {
  const rows: any[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabaseServer
      .from(table)
      .select(select)
      .order('id')
      .range(offset, offset + 499)
    if (error) throw new Error(`Could not load ${table}`)
    rows.push(...(data || []))
    if ((data?.length || 0) < 500) return rows
  }
}
const fingerprint = (value: unknown) => {
  const hex = createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
export async function getWorkspace(attempt = 0): Promise<any> {
  const periods = (await readAll('payroll_periods')) as (PayrollPeriod & {
    active_version_id: string | null
  })[]
  const [entries, employees, versions, events] = await Promise.all([
    readAll('payroll_entries') as Promise<PayrollEntry[]>,
    readAll('employees') as Promise<Employee[]>,
    readAll(
      'payroll_import_versions',
      'id,payroll_period_id,created_at,actor,source_name,reason',
    ),
    readAll('payroll_review_events'),
  ])
  // A replacement that committed during these reads requires a fresh consistent view.
  const stamps = await readAll(
    'payroll_periods',
    'id,active_version_id,updated_at',
  )
  if (
    JSON.stringify(
      stamps.map((p) => [p.id, p.active_version_id, p.updated_at]),
    ) !==
    JSON.stringify(
      periods.map((p) => [p.id, p.active_version_id, p.updated_at]),
    )
  ) {
    if (attempt < 2) return getWorkspace(attempt + 1)
    throw new Error('Payroll changed while loading. Please retry.')
  }
  periods.sort((a, b) => b.period_end.localeCompare(a.period_end))
  const byPeriod = new Map<string, PayrollEntry[]>()
  for (const entry of entries)
    byPeriod.set(entry.payroll_period_id, [
      ...(byPeriod.get(entry.payroll_period_id) || []),
      entry,
    ])
  const latestReview = new Map<string, any>()
  events.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  )
  for (const event of events)
    if (!latestReview.has(event.alert_id))
      latestReview.set(event.alert_id, event)
  const alerts = periods
    .flatMap((p) => {
      const previous = previousPeriod(p, periods)
      return buildAlerts(
        p,
        previous,
        byPeriod.get(p.id) || [],
        previous ? byPeriod.get(previous.id) || [] : [],
      ).map((alert) => {
        const id = fingerprint([
          2,
          p.active_version_id,
          previous?.active_version_id,
          alert,
        ])
        const review = latestReview.get(id)
        return {
          ...alert,
          id,
          is_reviewed: review?.is_reviewed || false,
          reviewed_by: review?.actor || null,
          reviewed_at: review?.created_at || null,
          review_note: review?.note || '',
        }
      })
    })
    .sort(
      (a, b) =>
        (({ high: 0, medium: 1, info: 2 })[a.severity as 'high'] ?? 3) -
        ({ high: 0, medium: 1, info: 2 }[b.severity as 'high'] ?? 3),
    )
  return {
    periods: periods.map(({ raw_text, ...p }) => {
      const rows = byPeriod.get(p.id) || [],
        totals = aggregate(rows),
        issues: string[] = []
      const check = (key: string, actual: number, expected: number) => {
        if (
          !Number.isFinite(expected) ||
          Math.abs(actual - expected) > (key.endsWith('hours') ? 0.0001 : 0.011)
        )
          issues.push(key.replace(/_/g, ' '))
      }
      for (const key of [
        'total_earnings',
        'total_hours',
        'total_withholdings',
        'total_deductions',
      ])
        check(key, totals[key] || 0, (p as any)[key])
      check('net_pay', totals.net_pay || 0, p.total_net_pay)
      if (rows.length !== p.total_persons) issues.push('employee count')
      const source = raw_text ? extractCompanyBreakdownFromText(raw_text) : null
      if (!source) issues.push('source journal unavailable')
      else
        for (const [key, value] of Object.entries(source))
          if (typeof value === 'number' && key in totals)
            check(key, totals[key], value)
      const openAlerts = alerts.filter(
        (a) => a.current_period_id === p.id && !a.is_reviewed,
      )
      const reviewId = fingerprint([
        'period',
        2,
        p.id,
        p.active_version_id,
        previousPeriod(p, periods)?.active_version_id,
      ])
      const periodReview = latestReview.get(reviewId)
      return {
        ...p,
        breakdown: totals,
        reconciliation: { matches: issues.length === 0, issues },
        open_alerts: openAlerts.length,
        reviewed: periodReview?.is_reviewed || false,
        reviewed_by: periodReview?.actor || null,
        reviewed_at: periodReview?.created_at || null,
        review_note: periodReview?.note || '',
        review_id: reviewId,
        source_available: !!raw_text,
      }
    }),
    entries,
    employees,
    alerts,
    versions,
    events,
  }
}
