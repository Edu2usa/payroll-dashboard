import type { ParsedPayroll } from './pdf-parser'

export const earningFields = ['regular_hours', 'regular_earnings', 'overtime_hours', 'overtime_earnings', 'double_time_hours', 'double_time_earnings', 'vacation_hours', 'vacation_earnings'] as const
export const withholdingFields = ['social_security', 'medicare', 'fed_income_tax', 'ct_income_tax', 'ct_pfl'] as const
export const deductionFields = ['health_deduction', 'simple_ira', 'hsa', 'loan_repayment', 'other_deduction'] as const

export function getPayrollReconciliationIssues(parsed: ParsedPayroll): string[] {
  const issues: string[] = []
  const check = (label: string, actual: number, expected: number, tolerance = 0.011) => {
    if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > tolerance) {
      issues.push(`${label} does not reconcile with the payroll journal`)
    }
  }
  const entries = parsed.employees.map(employee => employee.payroll_entry)
  if (!entries.length) issues.push('No employees were extracted')
  if (!parsed.period_start || !parsed.period_end || !parsed.check_date) issues.push('Payroll dates are missing')
  if (!/COMPANY\s+TOTALS/.test(parsed.raw_text) || !/COMPANY TOTAL\s*\n/.test(parsed.raw_text)) issues.push('Company totals are missing')
  check('Employee count', entries.length, parsed.totals.total_persons, 0)

  for (const employee of parsed.employees) {
    const entry = employee.payroll_entry
    const sum = (fields: readonly (keyof typeof entry)[]) => fields.reduce((total, field) => total + Number(entry[field]), 0)
    const label = `Employee ${employee.employee_id}`
    check(`${label} hours`, sum(['regular_hours', 'overtime_hours', 'double_time_hours', 'vacation_hours']), entry.total_hours, 0.0001)
    check(`${label} earnings`, sum(['regular_earnings', 'overtime_earnings', 'double_time_earnings', 'vacation_earnings']), entry.total_earnings)
    check(`${label} withholdings`, sum(withholdingFields), entry.total_withholdings)
    check(`${label} deductions`, sum(deductionFields), entry.total_deductions)
    check(`${label} net pay`, entry.total_earnings + entry.reimb_other_payments - entry.total_withholdings - entry.total_deductions, entry.net_pay)
  }

  for (const field of [...earningFields, ...withholdingFields, ...deductionFields]) {
    check(`Company ${field}`, entries.reduce((sum, entry) => sum + entry[field], 0), parsed.company_breakdown[field], field.endsWith('_hours') ? 0.0001 : 0.011)
  }
  for (const field of ['total_hours', 'total_earnings', 'total_withholdings', 'total_deductions'] as const) {
    check(`Company ${field}`, entries.reduce((sum, entry) => sum + entry[field], 0), parsed.totals[field], field === 'total_hours' ? 0.0001 : 0.011)
  }
  check('Company net pay', entries.reduce((sum, entry) => sum + entry.net_pay, 0), parsed.totals.total_net_pay)
  return issues
}
