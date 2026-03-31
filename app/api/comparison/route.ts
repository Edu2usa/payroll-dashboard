import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'
import { checkApiAuth } from '@/lib/auth'

function aggregateEntries(entries: any[]) {
  const agg = {
    regular_hours: 0,
    regular_earnings: 0,
    overtime_hours: 0,
    overtime_earnings: 0,
    double_time_hours: 0,
    double_time_earnings: 0,
    vacation_hours: 0,
    vacation_earnings: 0,
    total_hours: 0,
    total_earnings: 0,
    reimb_other_payments: 0,
    social_security: 0,
    medicare: 0,
    fed_income_tax: 0,
    ct_income_tax: 0,
    ct_pfl: 0,
    total_withholdings: 0,
    health_deduction: 0,
    simple_ira: 0,
    hsa: 0,
    loan_repayment: 0,
    other_deduction: 0,
    total_deductions: 0,
    net_pay: 0,
  }

  for (const e of entries) {
    agg.regular_hours += e.regular_hours || 0
    agg.regular_earnings += e.regular_earnings || 0
    agg.overtime_hours += e.overtime_hours || 0
    agg.overtime_earnings += e.overtime_earnings || 0
    agg.double_time_hours += e.double_time_hours || 0
    agg.double_time_earnings += e.double_time_earnings || 0
    agg.vacation_hours += e.vacation_hours || 0
    agg.vacation_earnings += e.vacation_earnings || 0
    agg.total_hours += e.total_hours || 0
    agg.total_earnings += e.total_earnings || 0
    agg.reimb_other_payments += e.reimb_other_payments || 0
    agg.social_security += e.social_security || 0
    agg.medicare += e.medicare || 0
    agg.fed_income_tax += e.fed_income_tax || 0
    agg.ct_income_tax += e.ct_income_tax || 0
    agg.ct_pfl += e.ct_pfl || 0
    agg.total_withholdings += e.total_withholdings || 0
    agg.health_deduction += e.health_deduction || 0
    agg.simple_ira += e.simple_ira || 0
    agg.hsa += e.hsa || 0
    agg.loan_repayment += e.loan_repayment || 0
    agg.other_deduction += e.other_deduction || 0
    agg.total_deductions += e.total_deductions || 0
    agg.net_pay += e.net_pay || 0
  }

  return agg
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('payroll_session')
    const apiKeyValid = checkApiAuth(request)

    if (!session && !apiKeyValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const currentId = searchParams.get('currentId')
    const previousId = searchParams.get('previousId')

    if (!currentId || !previousId) {
      return NextResponse.json({ error: 'Both currentId and previousId are required' }, { status: 400 })
    }

    // Fetch both periods and their entries in parallel
    const [curPeriodRes, prevPeriodRes, curEntriesRes, prevEntriesRes] = await Promise.all([
      supabaseServer.from('payroll_periods').select('*').eq('id', currentId).single(),
      supabaseServer.from('payroll_periods').select('*').eq('id', previousId).single(),
      supabaseServer.from('payroll_entries').select('*').eq('payroll_period_id', currentId),
      supabaseServer.from('payroll_entries').select('*').eq('payroll_period_id', previousId),
    ])

    if (!curPeriodRes.data || !prevPeriodRes.data) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    const curEntries = curEntriesRes.data || []
    const prevEntries = prevEntriesRes.data || []

    const currentAgg = aggregateEntries(curEntries)
    const previousAgg = aggregateEntries(prevEntries)

    // Build employee diff: who's new, who's missing, who's in both
    const curEmpIds = new Set(curEntries.map((e: any) => e.employee_id))
    const prevEmpIds = new Set(prevEntries.map((e: any) => e.employee_id))

    const allEmpIds = new Set([...curEmpIds, ...prevEmpIds])

    // Fetch employee names
    const { data: empNames } = await supabaseServer
      .from('employees')
      .select('id, first_name, last_name, department')
      .in('id', Array.from(allEmpIds))

    const nameMap: Record<string, { name: string; department: number }> = {}
    for (const emp of empNames || []) {
      nameMap[emp.id] = { name: `${emp.last_name}, ${emp.first_name}`, department: emp.department }
    }

    const curEntryMap = new Map(curEntries.map((e: any) => [e.employee_id, e]))
    const prevEntryMap = new Map(prevEntries.map((e: any) => [e.employee_id, e]))

    const newEmployees: any[] = []
    const missingEmployees: any[] = []

    for (const empId of curEmpIds) {
      if (!prevEmpIds.has(empId)) {
        const entry = curEntryMap.get(empId)
        newEmployees.push({
          employee_id: empId,
          name: nameMap[empId]?.name || 'Unknown',
          department: nameMap[empId]?.department || 0,
          total_hours: entry?.total_hours || 0,
          total_earnings: entry?.total_earnings || 0,
          net_pay: entry?.net_pay || 0,
        })
      }
    }

    for (const empId of prevEmpIds) {
      if (!curEmpIds.has(empId)) {
        const entry = prevEntryMap.get(empId)
        missingEmployees.push({
          employee_id: empId,
          name: nameMap[empId]?.name || 'Unknown',
          department: nameMap[empId]?.department || 0,
          total_hours: entry?.total_hours || 0,
          total_earnings: entry?.total_earnings || 0,
          net_pay: entry?.net_pay || 0,
        })
      }
    }

    return NextResponse.json({
      current: {
        ...curPeriodRes.data,
        breakdown: currentAgg,
      },
      previous: {
        ...prevPeriodRes.data,
        breakdown: previousAgg,
      },
      employeeDiff: {
        currentCount: curEmpIds.size,
        previousCount: prevEmpIds.size,
        newEmployees,
        missingEmployees,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
