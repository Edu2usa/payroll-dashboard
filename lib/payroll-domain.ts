import type { PayrollEntry, PayrollPeriod } from './supabase'
export const categories = [
  'regular',
  'overtime',
  'double_time',
  'vacation',
] as const
export const categoryLabels = {
  regular: 'Regular',
  overtime: 'Overtime',
  double_time: 'Double Time',
  vacation: 'Vacation',
}
export const money = (n: number = 0) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    n,
  )
export const number = (n: number = 0) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
export function dateOnly(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value.slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
}
export function dateTime(value?: string | null) {
  if (!value) return '—'
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value + 'Z'
  const date = new Date(normalized)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
}
export function journalContext(rawText: string, employeeNumber: number) {
  const lines = rawText.split('\n')
  const index = lines.findIndex(
    (line, i) =>
      /^#\s*Unknown\s*$/.test(line.trim()) &&
      lines[i + 1]?.trim() === String(employeeNumber),
  )
  return index < 0
    ? null
    : lines.slice(Math.max(0, index - 35), index + 100).join('\n')
}
export const periodLabel = (
  p: Pick<PayrollPeriod, 'period_start' | 'period_end'>,
) => `${dateOnly(p.period_start)} – ${dateOnly(p.period_end)}`
export const percentChange = (current: number, previous: number) =>
  previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100
export function previousPeriod<
  T extends Pick<PayrollPeriod, 'id' | 'period_end'>,
>(period: T, periods: T[]) {
  return (
    periods
      .filter((p) => p.period_end < period.period_end)
      .sort((a, b) => b.period_end.localeCompare(a.period_end))[0] || null
  )
}
export function aggregate(entries: Partial<PayrollEntry>[]) {
  const totals: Record<string, number> = {}
  for (const e of entries)
    for (const [key, value] of Object.entries(e)) {
      if (
        typeof value === 'number' &&
        key !== 'department' &&
        !key.endsWith('_rate')
      )
        totals[key] = (totals[key] || 0) + value
    }
  return totals
}
export function contributions(
  current: PayrollEntry[],
  previous: PayrollEntry[],
) {
  const c = new Map(current.map((e) => [e.employee_id, e])),
    p = new Map(previous.map((e) => [e.employee_id, e]))
  return [...new Set([...c.keys(), ...p.keys()])]
    .map((employee_id) => {
      const now = c.get(employee_id),
        before = p.get(employee_id)
      return {
        employee_id,
        status: !before
          ? 'New this period'
          : !now
            ? 'Absent this period'
            : 'Continuing',
        current: now || null,
        previous: before || null,
        difference:
          Math.round(
            ((now?.total_earnings || 0) - (before?.total_earnings || 0)) * 100,
          ) / 100,
        hours_difference: (now?.total_hours || 0) - (before?.total_hours || 0),
        categories: Object.fromEntries(
          categories.map((k) => [
            k,
            (now?.[`${k}_earnings`] || 0) - (before?.[`${k}_earnings`] || 0),
          ]),
        ),
      }
    })
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
}
export function csvText(rows: unknown[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let text = String(value ?? '')
            if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text))
              text = "'" + text
            return '"' + text.replace(/"/g, '""') + '"'
          })
          .join(','),
      )
      .join('\r\n')
  )
}
