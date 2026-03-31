import { supabaseServer, PayrollEntry, PayrollPeriod } from './supabase'

export interface DetectedDiscrepancy {
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

export async function detectDiscrepancies(
  payrollPeriodId: string,
  newEntries: PayrollEntry[]
): Promise<DetectedDiscrepancy[]> {
  const discrepancies: DetectedDiscrepancy[] = []

  // Get current payroll period
  const { data: currentPeriod } = await supabaseServer
    .from('payroll_periods')
    .select('*')
    .eq('id', payrollPeriodId)
    .single()

  if (!currentPeriod) return discrepancies

  // Get previous payroll period
  const { data: previousPeriods } = await supabaseServer
    .from('payroll_periods')
    .select('*')
    .neq('id', payrollPeriodId)
    .order('period_end', { ascending: false })
    .limit(1)

  const previousPeriod = previousPeriods?.[0]

  if (!previousPeriod) {
    // First payroll, check for new employees
    for (const entry of newEntries) {
      discrepancies.push({
        employee_id: entry.employee_id,
        current_period_id: payrollPeriodId,
        previous_period_id: null,
        type: 'new_employee',
        field: 'employee',
        severity: 'info',
        notes: 'First appearance in payroll',
        previous_value: null,
        current_value: entry.total_earnings,
        difference: null,
        percent_change: null,
      })
    }
    return discrepancies
  }

  const { data: prevEntries } = await supabaseServer
    .from('payroll_entries')
    .select('*')
    .eq('payroll_period_id', previousPeriod.id)

  const prevMap = new Map(prevEntries?.map(e => [e.employee_id, e]) || [])
  const newMap = new Map(newEntries.map(e => [e.employee_id, e]))

  // Check all new entries
  for (const [empId, newEntry] of newMap) {
    const prevEntry = prevMap.get(empId)

    if (!prevEntry) {
      discrepancies.push({
        employee_id: empId,
        current_period_id: payrollPeriodId,
        previous_period_id: previousPeriod.id,
        type: 'new_employee',
        field: 'employee',
        severity: 'info',
        notes: 'First appearance in this payroll',
        previous_value: null,
        current_value: newEntry.total_earnings,
        difference: null,
        percent_change: null,
      })
      continue
    }

    // Check hours change
    const prevHours = prevEntry.total_hours || 0
    const currHours = newEntry.total_hours || 0
    if (prevHours > 0 && currHours > 0) {
      const percentChange = Math.abs((currHours - prevHours) / prevHours)
      if (percentChange > 0.2) {
        discrepancies.push({
          employee_id: empId,
          current_period_id: payrollPeriodId,
          previous_period_id: previousPeriod.id,
          type: 'hours_change',
          field: 'total_hours',
          severity: percentChange > 0.5 ? 'high' : 'medium',
          notes: `Hours changed from ${prevHours} to ${currHours}`,
          previous_value: prevHours,
          current_value: currHours,
          difference: currHours - prevHours,
          percent_change: percentChange * 100,
        })
      }
    }

    // Check regular rate change
    const prevRegRate = prevEntry.regular_rate || 0
    const currRegRate = newEntry.regular_rate || 0
    if (prevRegRate > 0 && currRegRate > 0 && Math.abs(prevRegRate - currRegRate) > 0.01) {
      const percentChange = Math.abs((currRegRate - prevRegRate) / prevRegRate) * 100
      discrepancies.push({
        employee_id: empId,
        current_period_id: payrollPeriodId,
        previous_period_id: previousPeriod.id,
        type: 'rate_change',
        field: 'regular_rate',
        severity: 'high',
        notes: `Regular rate changed from $${prevRegRate.toFixed(2)} to $${currRegRate.toFixed(2)}`,
        previous_value: prevRegRate,
        current_value: currRegRate,
        difference: currRegRate - prevRegRate,
        percent_change: percentChange,
      })
    }

    // Check overtime spike
    const prevOT = prevEntry.overtime_hours || 0
    const currOT = newEntry.overtime_hours || 0
    if (currOT > prevOT && currOT > 20) {
      const percentChange = ((currOT - prevOT) / prevOT) * 100
      discrepancies.push({
        employee_id: empId,
        current_period_id: payrollPeriodId,
        previous_period_id: previousPeriod.id,
        type: 'overtime_spike',
        field: 'overtime_hours',
        severity: 'medium',
        notes: `Overtime hours spiked from ${prevOT} to ${currOT}`,
        previous_value: prevOT,
        current_value: currOT,
        difference: currOT - prevOT,
        percent_change: percentChange,
      })
    }

    // Check earnings vs hours calculation
    const currEarnings = newEntry.total_earnings || 0
    const currCalcEarnings = (newEntry.regular_hours || 0) * (newEntry.regular_rate || 0) +
                             (newEntry.overtime_hours || 0) * (newEntry.overtime_rate || 0) +
                             (newEntry.double_time_hours || 0) * (newEntry.double_time_rate || 0) +
                             (newEntry.vacation_hours || 0) * (newEntry.vacation_rate || 0)
    const earningsDiff = Math.abs(currEarnings - currCalcEarnings)
    if (earningsDiff > 1 && currEarnings > 0) {
      const percentChange = (earningsDiff / currEarnings) * 100
      discrepancies.push({
        employee_id: empId,
        current_period_id: payrollPeriodId,
        previous_period_id: previousPeriod.id,
        type: 'earnings_anomaly',
        field: 'total_earnings',
        severity: 'medium',
        notes: `Earnings don't match calculated amount`,
        previous_value: currCalcEarnings,
        current_value: currEarnings,
        difference: earningsDiff,
        percent_change: percentChange,
      })
    }

    // Check deduction change
    const prevDed = prevEntry.total_deductions || 0
    const currDed = newEntry.total_deductions || 0
    if (prevDed > 0 && currDed > 0 && Math.abs(prevDed - currDed) > prevDed * 0.1) {
      const percentChange = Math.abs((currDed - prevDed) / prevDed) * 100
      discrepancies.push({
        employee_id: empId,
        current_period_id: payrollPeriodId,
        previous_period_id: previousPeriod.id,
        type: 'deduction_change',
        field: 'total_deductions',
        severity: 'medium',
        notes: `Deductions changed from $${prevDed.toFixed(2)} to $${currDed.toFixed(2)}`,
        previous_value: prevDed,
        current_value: currDed,
        difference: currDed - prevDed,
        percent_change: percentChange,
      })
    }

    // Check department change
    if (prevEntry.department !== newEntry.department) {
      discrepancies.push({
        employee_id: empId,
        current_period_id: payrollPeriodId,
        previous_period_id: previousPeriod.id,
        type: 'department_change',
        field: 'department',
        severity: 'medium',
        notes: `Moved from department ${prevEntry.department} to ${newEntry.department}`,
        previous_value: prevEntry.department,
        current_value: newEntry.department,
        difference: null,
        percent_change: null,
      })
    }
  }

  // Check for missing employees
  for (const [empId, prevEntry] of prevMap) {
    if (!newMap.has(empId)) {
      discrepancies.push({
        employee_id: empId,
        current_period_id: payrollPeriodId,
        previous_period_id: previousPeriod.id,
        type: 'missing_employee',
        field: 'employee',
        severity: 'high',
        notes: 'Employee was in previous payroll but not in current',
        previous_value: prevEntry.total_earnings,
        current_value: null,
        difference: null,
        percent_change: null,
      })
    }
  }

  return discrepancies
}
