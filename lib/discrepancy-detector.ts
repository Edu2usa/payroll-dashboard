import { supabaseServer, PayrollEntry, PayrollPeriod } from './supabase'

export interface DetectedDiscrepancy {
  employee_id: string
  type: string
  severity: string
  description: string
  previous_value: number | null
  current_value: number | null
  difference: number | null
}

export async function detectDiscrepancies(
  payrollPeriodId: string,
  newEntries: PayrollEntry[]
): Promise<DetectedDiscrepancy[]> {
  const discrepancies: DetectedDiscrepancy[] = []

  // Get previous payroll period
  const { data: currentPeriod } = await supabaseServer
    .from('payroll_periods')
    .select('*')
    .eq('id', payrollPeriodId)
    .single()

  if (!currentPeriod) return discrepancies

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
        type: 'new_employee',
        severity: 'info',
        description: 'First appearance in payroll',
        previous_value: null,
        current_value: entry.total_earnings,
        difference: null,
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
        type: 'new_employee',
        severity: 'info',
        description: 'First appearance in this payroll',
        previous_value: null,
        current_value: newEntry.total_earnings,
        difference: null,
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
          type: 'hours_change',
          severity: percentChange > 0.5 ? 'high' : 'medium',
          description: `Hours changed from ${prevHours} to ${currHours} (${(percentChange * 100).toFixed(1)}%)`,
          previous_value: prevHours,
          current_value: currHours,
          difference: currHours - prevHours,
        })
      }
    }

    // Check rate change
    const prevRate = prevEntry.hourly_rate || 0
    const currRate = newEntry.hourly_rate || 0
    if (prevRate > 0 && currRate > 0 && Math.abs(prevRate - currRate) > 0.01) {
      discrepancies.push({
        employee_id: empId,
        type: 'rate_change',
        severity: 'high',
        description: `Hourly rate changed from $${prevRate.toFixed(2)} to $${currRate.toFixed(2)}`,
        previous_value: prevRate,
        current_value: currRate,
        difference: currRate - prevRate,
      })
    }

    // Check overtime spike
    const prevOT = prevEntry.overtime_hours || 0
    const currOT = newEntry.overtime_hours || 0
    if (currOT > prevOT && currOT > 20) {
      discrepancies.push({
        employee_id: empId,
        type: 'overtime_spike',
        severity: 'medium',
        description: `Overtime hours spiked from ${prevOT} to ${currOT}`,
        previous_value: prevOT,
        current_value: currOT,
        difference: currOT - prevOT,
      })
    }

    // Check earnings vs hours calculation
    const currEarnings = newEntry.total_earnings || 0
    const currCalcEarnings = (newEntry.regular_hours || 0) * (newEntry.hourly_rate || 0) +
                             (newEntry.overtime_hours || 0) * (newEntry.hourly_rate || 0) * 1.5 +
                             (newEntry.double_time_hours || 0) * (newEntry.hourly_rate || 0) * 2 +
                             (newEntry.vacation_hours || 0) * (newEntry.hourly_rate || 0)
    const earningsDiff = Math.abs(currEarnings - currCalcEarnings)
    if (earningsDiff > 1 && currEarnings > 0) {
      discrepancies.push({
        employee_id: empId,
        type: 'earnings_anomaly',
        severity: 'medium',
        description: `Earnings ($${currEarnings.toFixed(2)}) don't match calculated amount ($${currCalcEarnings.toFixed(2)})`,
        previous_value: currCalcEarnings,
        current_value: currEarnings,
        difference: earningsDiff,
      })
    }

    // Check deduction change
    const prevDed = prevEntry.total_deductions || 0
    const currDed = newEntry.total_deductions || 0
    if (prevDed > 0 && currDed > 0 && Math.abs(prevDed - currDed) > prevDed * 0.1) {
      discrepancies.push({
        employee_id: empId,
        type: 'deduction_change',
        severity: 'medium',
        description: `Deductions changed from $${prevDed.toFixed(2)} to $${currDed.toFixed(2)}`,
        previous_value: prevDed,
        current_value: currDed,
        difference: currDed - prevDed,
      })
    }

    // Check department change
    if (prevEntry.department !== newEntry.department) {
      discrepancies.push({
        employee_id: empId,
        type: 'department_change',
        severity: 'medium',
        description: `Moved from department ${prevEntry.department} to ${newEntry.department}`,
        previous_value: prevEntry.department,
        current_value: newEntry.department,
        difference: null,
      })
    }
  }

  // Check for missing employees
  for (const [empId, prevEntry] of prevMap) {
    if (!newMap.has(empId)) {
      discrepancies.push({
        employee_id: empId,
        type: 'missing_employee',
        severity: 'high',
        description: 'Employee was in previous payroll but not in current',
        previous_value: prevEntry.total_earnings,
        current_value: null,
        difference: null,
      })
    }
  }

  return discrepancies
}
