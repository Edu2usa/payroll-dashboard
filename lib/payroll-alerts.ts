import type { PayrollEntry, PayrollPeriod } from './supabase'
import { categories, percentChange } from './payroll-domain'
export interface PayrollAlert {
  employee_id: string
  current_period_id: string
  previous_period_id: string | null
  type: string
  field: string
  severity: string
  notes: string
  previous_value: number | null
  current_value: number | null
  difference: number | null
  percent_change: number | null
}
// Reported earnings reconcile salary and multiple earning lines. A flag highlights a change, not a confirmed error.
export function buildAlerts(
  current: Pick<PayrollPeriod, 'id'>,
  previous: Pick<PayrollPeriod, 'id'> | null,
  entries: PayrollEntry[],
  prior: PayrollEntry[],
): PayrollAlert[] {
  const alerts: PayrollAlert[] = [],
    prev = new Map(prior.map((e) => [e.employee_id, e]))
  const push = (
    e: PayrollEntry,
    type: string,
    field: string,
    severity: string,
    notes: string,
    before: number | null,
    now: number | null,
  ) =>
    alerts.push({
      employee_id: e.employee_id,
      current_period_id: current.id,
      previous_period_id: previous?.id || null,
      type,
      field,
      severity,
      notes,
      previous_value: before,
      current_value: now,
      difference: before === null || now === null ? null : now - before,
      percent_change:
        before === null || now === null ? null : percentChange(now, before),
    })
  for (const e of entries) {
    const p = prev.get(e.employee_id)
    if (previous && !p)
      push(
        e,
        'new_employee',
        'employee',
        'info',
        'Present in this payroll; absent from the preceding payroll. This is not a confirmed hire.',
        0,
        e.total_earnings,
      )
    const categoryTotal = categories.reduce(
      (n, k) => n + (e[`${k}_earnings`] || 0),
      0,
    )
    if (Math.abs(categoryTotal - e.total_earnings) > 0.011)
      push(
        e,
        'earnings_anomaly',
        'total_earnings',
        'high',
        'Reported earning categories do not add up to gross pay.',
        categoryTotal,
        e.total_earnings,
      )
    const net =
      e.total_earnings +
      (e.reimb_other_payments || 0) -
      e.total_withholdings -
      e.total_deductions
    if (Math.abs(net - e.net_pay) > 0.011)
      push(
        e,
        'earnings_anomaly',
        'net_pay',
        'high',
        'Gross plus reimbursements, less taxes and deductions, does not equal net pay.',
        net,
        e.net_pay,
      )
    for (const k of ['overtime', 'double_time'] as const) {
      const now = e[`${k}_hours`] || 0,
        before = p?.[`${k}_hours`] || 0
      if (now > 20 && now > before)
        push(
          e,
          'overtime_spike',
          `${k}_hours`,
          'medium',
          `${k === 'overtime' ? 'Overtime' : 'Double Time'} exceeds 20 hours and increased from ${before} to ${now} hours.`,
          before,
          now,
        )
    }
    if (!p) continue
    const change = percentChange(e.total_hours || 0, p.total_hours || 0)
    if (
      e.total_hours !== p.total_hours &&
      (change === null || Math.abs(change) > 20)
    )
      push(
        e,
        'hours_change',
        'total_hours',
        change === null || Math.abs(change) > 50 ? 'high' : 'medium',
        `Hours changed from ${p.total_hours || 0} to ${e.total_hours || 0}.`,
        p.total_hours || 0,
        e.total_hours || 0,
      )
    if (e.regular_hours > 0 && p.regular_hours > 0) {
      const rate = e.regular_earnings / e.regular_hours,
        old = p.regular_earnings / p.regular_hours
      if (Math.abs(rate - old) > 0.02)
        push(
          e,
          'rate_change',
          'effective_regular_rate',
          'medium',
          'Average regular earnings per hour changed. Multiple rates or additional pay may explain this; inspect the journal.',
          old,
          rate,
        )
    }
    const deductionChange = Math.abs(e.total_deductions - p.total_deductions)
    if (
      deductionChange > 0.011 &&
      (p.total_deductions === 0 ||
        deductionChange > Math.abs(p.total_deductions) * 0.1)
    )
      push(
        e,
        'deduction_change',
        'total_deductions',
        'medium',
        'Deductions changed by more than 10%, started, or stopped.',
        p.total_deductions || 0,
        e.total_deductions || 0,
      )
    if (p.department !== e.department)
      push(
        e,
        'department_change',
        'department',
        'info',
        `Department changed from ${p.department} to ${e.department}.`,
        p.department,
        e.department,
      )
  }
  const ids = new Set(entries.map((e) => e.employee_id))
  for (const e of prior)
    if (!ids.has(e.employee_id))
      push(
        e,
        'missing_employee',
        'employee',
        'info',
        'Absent from this payroll but present in the preceding payroll. Check whether this is expected.',
        e.total_earnings,
        0,
      )
  return alerts
}
