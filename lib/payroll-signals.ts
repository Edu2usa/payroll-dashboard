import { number, money } from './payroll-domain'

type SignalPeriod = {
  id: string
  period_start: string
  period_end: string
  breakdown: Record<string, number>
}
export type PayrollSignal = {
  category: 'double_time' | 'overtime'
  title: string
  explanation: string
  baseline: number
  baseline_count: number
  current: number
  previous: number
  previous_period_id: string
  earnings: number
  earnings_change: number
}
const span = (p: SignalPeriod) =>
  Date.parse(p.period_end) - Date.parse(p.period_start)
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

// Compare comparable, earlier payrolls only. A repeated spike remains visible
// while it is unusual against recent history, even if last period was also high.
export function payrollSignals(
  current: SignalPeriod,
  periods: SignalPeriod[],
): PayrollSignal[] {
  const history = periods
    .filter(
      (p) => p.period_end < current.period_end && span(p) === span(current),
    )
    .sort((a, b) => b.period_end.localeCompare(a.period_end))
    .slice(0, 6)
  if (!history.length) return []
  return (['double_time', 'overtime'] as const).flatMap((category) => {
    const label = category === 'double_time' ? 'Double Time' : 'Overtime'
    const now = current.breakdown[`${category}_hours`] || 0
    const before = history[0].breakdown[`${category}_hours`] || 0
    const baseline =
      history.length >= 3
        ? median(history.map((p) => p.breakdown[`${category}_hours`] || 0))
        : before
    const increase = category === 'double_time' ? 8 : 40
    const multiplier = category === 'double_time' ? 2 : 1.5
    if (
      now <= baseline ||
      now - baseline < increase ||
      now < baseline * multiplier
    )
      return []
    const earnings = current.breakdown[`${category}_earnings`] || 0
    const earningsChange =
      earnings - (history[0].breakdown[`${category}_earnings`] || 0)
    const reference =
      history.length >= 3
        ? `the median of ${history.length} preceding payrolls of the same length`
        : 'the preceding payroll of the same length'
    return [
      {
        category,
        title: `${label} is unusually high`,
        baseline,
        baseline_count: history.length >= 3 ? history.length : 1,
        current: now,
        previous: before,
        previous_period_id: history[0].id,
        earnings,
        earnings_change: earningsChange,
        explanation: `${number(now)} hours versus ${number(baseline)} hours in ${reference}. ${label} pay is ${money(earnings)}. Check the contributors and journal for the reason; this may be expected.`,
      },
    ]
  })
}
