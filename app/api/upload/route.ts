import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'
import { parsePaychexPDF } from '@/lib/pdf-parser'
import { detectDiscrepancies } from '@/lib/discrepancy-detector'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('payroll_session')
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parsePaychexPDF(buffer)

    // Create payroll period
    const { data: period, error: periodError } = await supabaseServer
      .from('payroll_periods')
      .insert({
        period_start: parsed.period_start,
        period_end: parsed.period_end,
        check_date: parsed.check_date,
        run_date: parsed.run_date,
        total_gross: parsed.totals.total_gross,
        total_net: parsed.totals.total_net,
        total_withholdings: parsed.totals.total_withholdings,
        total_deductions: parsed.totals.total_deductions,
        employee_count: parsed.totals.employee_count,
        status: 'active',
        pdf_filename: file.name,
      })
      .select()

    if (periodError || !period || period.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create payroll period' },
        { status: 500 }
      )
    }

    const payrollPeriodId = period[0].id

    // Upsert employees
    for (const emp of parsed.employees) {
      const { error: empError } = await supabaseServer
        .from('employees')
        .upsert({
          employee_id: emp.employee_id,
          name: emp.name,
          department: emp.department,
          hourly_rate: emp.hourly_rate,
          is_active: true,
          first_seen: emp.first_seen,
          last_seen: emp.last_seen,
        }, { onConflict: 'employee_id' })

      if (empError) {
        console.error('Employee upsert error:', empError)
      }
    }

    // Get employee IDs
    const { data: employees } = await supabaseServer
      .from('employees')
      .select('id, employee_id')

    const empMap = new Map(employees?.map(e => [e.employee_id, e.id]) || [])

    // Create payroll entries
    const entries = parsed.employees.map(emp => ({
      payroll_period_id: payrollPeriodId,
      employee_id: empMap.get(emp.employee_id),
      department: emp.department,
      regular_hours: emp.payroll_entry.regular_hours,
      overtime_hours: emp.payroll_entry.overtime_hours,
      double_time_hours: emp.payroll_entry.double_time_hours,
      vacation_hours: emp.payroll_entry.vacation_hours,
      total_hours: emp.payroll_entry.total_hours,
      regular_earnings: emp.payroll_entry.regular_earnings,
      overtime_earnings: emp.payroll_entry.overtime_earnings,
      double_time_earnings: emp.payroll_entry.double_time_earnings,
      vacation_earnings: emp.payroll_entry.vacation_earnings,
      total_earnings: emp.payroll_entry.total_earnings,
      hourly_rate: emp.payroll_entry.hourly_rate,
      social_security: emp.payroll_entry.social_security,
      medicare: emp.payroll_entry.medicare,
      fed_income_tax: emp.payroll_entry.fed_income_tax,
      ct_income_tax: emp.payroll_entry.ct_income_tax,
      ct_pfl: emp.payroll_entry.ct_pfl,
      total_withholdings: emp.payroll_entry.total_withholdings,
      health_deduction: emp.payroll_entry.health_deduction,
      simple_ira: emp.payroll_entry.simple_ira,
      other_deductions: emp.payroll_entry.other_deductions,
      total_deductions: emp.payroll_entry.total_deductions,
      net_pay: emp.payroll_entry.net_pay,
      check_number: emp.payroll_entry.check_number,
      direct_deposit_number: emp.payroll_entry.direct_deposit_number,
    }))

    const { error: entriesError } = await supabaseServer
      .from('payroll_entries')
      .insert(entries)

    if (entriesError) {
      return NextResponse.json(
        { error: 'Failed to create payroll entries' },
        { status: 500 }
      )
    }

    // Detect discrepancies
    const discrepancies = await detectDiscrepancies(payrollPeriodId, entries as any)

    // Insert discrepancies
    if (discrepancies.length > 0) {
      const discrepancyRecords = discrepancies.map(d => ({
        payroll_period_id: payrollPeriodId,
        employee_id: empMap.get(d.employee_id),
        type: d.type,
        severity: d.severity,
        description: d.description,
        previous_value: d.previous_value,
        current_value: d.current_value,
        difference: d.difference,
        is_reviewed: false,
      }))

      await supabaseServer
        .from('discrepancies')
        .insert(discrepancyRecords)
    }

    return NextResponse.json({
      success: true,
      payrollPeriodId,
      employeeCount: parsed.totals.employee_count,
      discrepancyCount: discrepancies.length,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
