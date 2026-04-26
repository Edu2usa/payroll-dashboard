import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'
import { checkApiAuth } from '@/lib/auth'

interface DashboardData {
  latestPeriod: {
    id: string
    period_start: string
    period_end: string
    check_date: string
    total_earnings: number
    total_net_pay: number
    total_hours: number
    total_persons: number
    total_withholdings: number
    total_deductions: number
  }
  periodChange: {
    earnings_change_pct: number
    net_pay_change_pct: number
    hours_change_pct: number
    employees_change_pct: number
    withholdings_change_pct: number
  }
  departmentBreakdown: Array<{
    department: number
    earnings: number
    hours: number
    employees: number
  }>
  topEarners: Array<{
    name: string
    department: number
    hours: number
    earnings: number
    net_pay: number
  }>
  overtimeSummary: {
    total_ot_hours: number
    total_ot_earnings: number
    employees_with_ot: number
  }
  allPeriods: Array<{
    id: string
    period_start: string
    period_end: string
    check_date: string
    total_earnings: number
    total_net_pay: number
    total_persons: number
    total_hours: number
    total_withholdings: number
    total_deductions: number
  }>
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('payroll_session')
    const apiKeyValid = checkApiAuth(request)

    if (!session && !apiKeyValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all periods ordered by check_date DESC
    const { data: allPeriodsData, error: periodsError } = await supabaseServer
      .from('payroll_periods')
      .select('id, period_start, period_end, check_date, total_earnings, total_net_pay, total_persons, total_hours, total_withholdings, total_deductions')
      .order('check_date', { ascending: false })
      .limit(100)

    if (periodsError) {
      return NextResponse.json({ error: periodsError.message }, { status: 500 })
    }

    if (!allPeriodsData || allPeriodsData.length === 0) {
      return NextResponse.json({
        error: 'No payroll periods found'
      }, { status: 404 })
    }

    const latestPeriod = (allPeriodsData[0] || null) as any
    const previousPeriod = (allPeriodsData[1] || null) as any

    // Calculate period-over-period changes (guard against division by zero)
    function safePctChange(current: number, previous: number): number {
      if (!previous || previous === 0) return 0
      return ((current - previous) / previous) * 100
    }

    const periodChange = {
      earnings_change_pct: previousPeriod
        ? safePctChange(latestPeriod.total_earnings, previousPeriod.total_earnings)
        : 0,
      net_pay_change_pct: previousPeriod
        ? safePctChange(latestPeriod.total_net_pay, previousPeriod.total_net_pay)
        : 0,
      hours_change_pct: previousPeriod
        ? safePctChange(latestPeriod.total_hours, previousPeriod.total_hours)
        : 0,
      employees_change_pct: previousPeriod
        ? safePctChange(latestPeriod.total_persons, previousPeriod.total_persons)
        : 0,
      withholdings_change_pct: previousPeriod
        ? safePctChange(latestPeriod.total_withholdings, previousPeriod.total_withholdings)
        : 0,
    }

    // Get department breakdown for latest period
    const { data: departmentData, error: deptError } = await supabaseServer
      .from('payroll_entries')
      .select('department, total_earnings, total_hours')
      .eq('payroll_period_id', latestPeriod.id)

    if (deptError) {
      return NextResponse.json({ error: deptError.message }, { status: 500 })
    }

    const departmentRows = (departmentData || []) as any[]

    const departmentBreakdown = departmentRows.length > 0 ? Object.values(
      departmentRows.reduce((acc: any, entry: any) => {
        const dept = entry.department || 0
        if (!acc[dept]) {
          acc[dept] = { department: dept, earnings: 0, hours: 0, employees: 0 }
        }
        acc[dept].earnings += entry.total_earnings || 0
        acc[dept].hours += entry.total_hours || 0
        acc[dept].employees += 1
        return acc
      }, {})
    ) : []

    // Get top 10 earners for latest period
    const { data: topEarnersData, error: earnerError } = await supabaseServer
      .from('payroll_entries')
      .select('employee_id, department, total_hours, total_earnings, net_pay')
      .eq('payroll_period_id', latestPeriod.id)
      .order('total_earnings', { ascending: false })
      .limit(10)

    if (earnerError) {
      return NextResponse.json({ error: earnerError.message }, { status: 500 })
    }

    const topEarnersRows = (topEarnersData || []) as any[]

    let topEarners: any[] = []
    if (topEarnersRows.length > 0) {
      const employeeIds = topEarnersRows.map((e: any) => e.employee_id)
      const { data: employeeNames, error: empError } = await supabaseServer
        .from('employees')
        .select('id, first_name, last_name')
        .in('id', employeeIds)

      if (empError) {
        console.error('Error fetching employee names:', empError)
      }

      const employeeNameRows = (employeeNames || []) as any[]

      const nameMap = employeeNameRows.length > 0 ? Object.fromEntries(
        employeeNameRows.map((e: any) => [e.id, `${e.first_name} ${e.last_name}`])
      ) : {}

      topEarners = topEarnersRows.map((entry: any) => ({
        name: nameMap[entry.employee_id] || 'Unknown',
        department: entry.department || 0,
        hours: entry.total_hours,
        earnings: entry.total_earnings,
        net_pay: entry.net_pay,
      }))
    }

    // Get overtime summary for latest period
    const { data: overtimeData, error: otError } = await supabaseServer
      .from('payroll_entries')
      .select('overtime_hours, overtime_earnings, employee_id')
      .eq('payroll_period_id', latestPeriod.id)
      .gt('overtime_hours', 0)

    if (otError) {
      return NextResponse.json({ error: otError.message }, { status: 500 })
    }

    const overtimeRows = (overtimeData || []) as any[]

    const overtimeSummary = {
      total_ot_hours: overtimeRows.reduce((sum: number, e: any) => sum + (e.overtime_hours || 0), 0),
      total_ot_earnings: overtimeRows.reduce((sum: number, e: any) => sum + (e.overtime_earnings || 0), 0),
      employees_with_ot: new Set(overtimeRows.map((e: any) => e.employee_id)).size,
    }

    const responseData: DashboardData = {
      latestPeriod: {
        id: latestPeriod.id,
        period_start: latestPeriod.period_start,
        period_end: latestPeriod.period_end,
        check_date: latestPeriod.check_date,
        total_earnings: latestPeriod.total_earnings,
        total_net_pay: latestPeriod.total_net_pay,
        total_hours: latestPeriod.total_hours,
        total_persons: latestPeriod.total_persons,
        total_withholdings: latestPeriod.total_withholdings,
        total_deductions: latestPeriod.total_deductions,
      },
      periodChange,
      departmentBreakdown: departmentBreakdown as any,
      topEarners,
      overtimeSummary,
      allPeriods: allPeriodsData as any,
    }

    return NextResponse.json(responseData)
  } catch (err) {
    console.error('Dashboard API error:', err)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
