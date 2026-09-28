import type { ParsedPayroll } from './pdf-parser'
import { earningFields } from './payroll-reconciliation'

export function compareImport(parsed: ParsedPayroll, previous?: ParsedPayroll) {
  if (!previous) return null
  const previousIds = new Set(previous.employees.map((e) => e.employee_id))
  const currentIds = new Set(parsed.employees.map((e) => e.employee_id))
  // Baseline snapshots predate company_breakdown. Use their retained entries.
  const breakdown = Object.fromEntries(
    earningFields.map((field) => [
      field,
      previous.employees.reduce(
        (sum, e) => sum + Number(e.payroll_entry[field] || 0),
        0,
      ),
    ]),
  ) as Pick<ParsedPayroll['company_breakdown'], (typeof earningFields)[number]>
  return {
    totals: Object.fromEntries(
      Object.keys(parsed.totals).map((field) => [
        field,
        Number(previous.totals[field as keyof ParsedPayroll['totals']]),
      ]),
    ) as ParsedPayroll['totals'],
    check_date: previous.check_date,
    breakdown,
    addedEmployees: [...currentIds].filter((id) => !previousIds.has(id)).length,
    removedEmployees: [...previousIds].filter((id) => !currentIds.has(id))
      .length,
  }
}

export type ImportPreview = Pick<
  ParsedPayroll,
  'period_start' | 'period_end' | 'check_date' | 'totals' | 'company_breakdown'
> & {
  expectedVersion: string | null
  previous: ReturnType<typeof compareImport>
  hash: string
}
