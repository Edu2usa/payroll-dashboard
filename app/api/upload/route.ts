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

    // Check if this payroll period already exists
    const { data: existingPeriod } = await supabaseServer
      .from('payroll_periods')
      .select('id')
      .eq('period_start', parsed.period_start)
      .eq('period_end', parsed.period_end)
      .limit(1)

    const existingPeriodRows = (existingPeriod || []) as Array<{ id: string }>

    let payrollPeriodId: string

    if (existingPeriodRows.length > 0) {
      // Period already exists — delete old data and replace
      payrollPeriodId = existingPeriodRows[0].id
      console.log(`Replacing existing period ${payrollPeriodId} (${parsed.period_start} - ${parsed.period_end})`)

      // Delete old discrepancies, entries for this period
      await supabaseServer.from('discrepancies').delete().eq('current_period_id', payrollPeriodId)
      await supabaseServer.from('payroll_entries').delete().eq('payroll_period_id', payrollPeriodId)

      // Update the period record with new totals
      const periodUpdatePayload: any = {
        check_date: parsed.check_date,
        run_date: parsed.run_date,
        total_persons: parsed.totals.total_persons,
        total_transactions: parsed.totals.total_transactions,
        total_hours: parsed.totals.total_hours,
        total_earnings: parsed.totals.total_earnings,
        total_withholdings: parsed.totals.total_withholdings,
        total_deductions: parsed.totals.total_deductions,
        total_employer_liability: parsed.totals.total_employer_liability,
        total_tax_liability: parsed.totals.total_tax_liability,
        total_net_pay: parsed.totals.total_net_pay,
        raw_text: parsed.raw_text,
      }

      const { error: updateError } = await (supabaseServer
        .from('payroll_periods') as any)
        .update({
          ...periodUpdatePayload,
        })
        .eq('id', payrollPeriodId)

      if (updateError) {
        console.error('Period update error:', JSON.stringify(updateError))
        return NextResponse.json(
          { error: 'Failed to update payroll period', detail: updateError?.message },
          { status: 500 }
        )
      }
    } else {
      // Create new payroll period
      const { data: period, error: periodError } = await (supabaseServer
        .from('payroll_periods') as any)
        .insert({
          period_start: parsed.period_start,
          period_end: parsed.period_end,
          check_date: parsed.check_date,
          run_date: parsed.run_date,
          company_id: 'default',
          total_persons: parsed.totals.total_persons,
          total_transactions: parsed.totals.total_transactions,
          total_hours: parsed.totals.total_hours,
          total_earnings: parsed.totals.total_earnings,
          total_withholdings: parsed.totals.total_withholdings,
          total_deductions: parsed.totals.total_deductions,
          total_employer_liability: parsed.totals.total_employer_liability,
          total_tax_liability: parsed.totals.total_tax_liability,
          total_net_pay: parsed.totals.total_net_pay,
          raw_text: parsed.raw_text,
        })
        .select()

      if (periodError || !period || period.length === 0) {
        console.error('Period insert error:', JSON.stringify(periodError))
        return NextResponse.json(
          { error: 'Failed to create payroll period', detail: periodError?.message || 'No data returned' },
          { status: 500 }
        )
      }

      payrollPeriodId = (period as Array<{ id: string }>)[0].id
    }

    // Upsert employees
    let upsertErrorCount = 0
    for (const emp of parsed.employees) {
      const { error: empError } = await (supabaseServer
        .from('employees') as any)
        .upsert({
          employee_id: emp.employee_id,
          last_name: emp.last_name,
          first_name: emp.first_name,
          middle_initial: emp.middle_initial,
          department: emp.department,
          is_active: true,
          first_seen: emp.first_seen,
          last_seen: emp.last_seen,
        } as any, { onConflict: 'employee_id' })

      if (empError) {
        upsertErrorCount++
        if (upsertErrorCount === 1) {
          // Only log first error in detail to avoid spam
          console.error('Employee upsert error - Full error object:', empError)
          console.error('Employee upsert error - Code:', empError?.code)
          console.error('Employee upsert error - Message:', empError?.message)
          console.error('Employee upsert error - Details:', empError?.details)
          console.error('Failed employee:', JSON.stringify({ employee_id: emp.employee_id, last_name: emp.last_name, first_name: emp.first_name }))
        }
      }
    }
    if (upsertErrorCount > 0) {
      console.warn(`Employee upsert: ${upsertErrorCount} errors out of ${parsed.employees.length} employees`)
    }

    // Get employee IDs
    const { data: employees } = await supabaseServer
      .from('employees')
      .select('id, employee_id')

    const employeeRows = (employees || []) as Array<{ id: string; employee_id: number }>
    const empMap = new Map<any, string>(employeeRows.map((e) => [e.employee_id, e.id]))

    // Create payroll entries
    const entries = parsed.employees.map(emp => ({
      payroll_period_id: payrollPeriodId,
      employee_id: empMap.get(emp.employee_id),
      department: emp.department,
      regular_hours: emp.payroll_entry.regular_hours,
      regular_rate: emp.payroll_entry.regular_rate,
      regular_earnings: emp.payroll_entry.regular_earnings,
      overtime_hours: emp.payroll_entry.overtime_hours,
      overtime_rate: emp.payroll_entry.overtime_rate,
      overtime_earnings: emp.payroll_entry.overtime_earnings,
      double_time_hours: emp.payroll_entry.double_time_hours,
      double_time_rate: emp.payroll_entry.double_time_rate,
      double_time_earnings: emp.payroll_entry.double_time_earnings,
      vacation_hours: emp.payroll_entry.vacation_hours,
      vacation_rate: emp.payroll_entry.vacation_rate,
      vacation_earnings: emp.payroll_entry.vacation_earnings,
      total_hours: emp.payroll_entry.total_hours,
      total_earnings: emp.payroll_entry.total_earnings,
      reimb_other_payments: emp.payroll_entry.reimb_other_payments,
      social_security: emp.payroll_entry.social_security,
      medicare: emp.payroll_entry.medicare,
      fed_income_tax: emp.payroll_entry.fed_income_tax,
      ct_income_tax: emp.payroll_entry.ct_income_tax,
      ct_pfl: emp.payroll_entry.ct_pfl,
      total_withholdings: emp.payroll_entry.total_withholdings,
      health_deduction: emp.payroll_entry.health_deduction,
      simple_ira: emp.payroll_entry.simple_ira,
      hsa: emp.payroll_entry.hsa,
      loan_repayment: emp.payroll_entry.loan_repayment,
      other_deduction: emp.payroll_entry.other_deduction,
      total_deductions: emp.payroll_entry.total_deductions,
      net_pay: emp.payroll_entry.net_pay,
      direct_deposit_amount: emp.payroll_entry.direct_deposit_amount,
      check_amount: emp.payroll_entry.check_amount,
      check_number: emp.payroll_entry.check_number,
    }))

    const { error: entriesError } = await (supabaseServer
      .from('payroll_entries') as any)
      .insert(entries)

    if (entriesError) {
      console.error('Entries insert error - Full error object:', entriesError)
      console.error('Entries insert error - Code:', entriesError?.code)
      console.error('Entries insert error - Message:', entriesError?.message)
      console.error('Entries insert error - Details:', entriesError?.details)
      console.error('Number of entries attempted to insert:', entries.length)
      if (entries.length > 0) {
        console.error('First entry sample:', JSON.stringify(entries[0], null, 2))
      }
      return NextResponse.json(
        { error: 'Failed to create payroll entries', detail: entriesError?.message, code: entriesError?.code },
        { status: 500 }
      )
    }

    // Detect discrepancies
    const discrepancies = await detectDiscrepancies(payrollPeriodId, entries as any)

    // Insert discrepancies
    if (discrepancies.length > 0) {
      const discrepancyRecords = discrepancies.map(d => ({
        employee_id: empMap.get(d.employee_id),
        current_period_id: d.current_period_id,
        previous_period_id: d.previous_period_id,
        type: d.type,
        field: d.field,
        severity: d.severity,
        notes: d.notes,
        previous_value: d.previous_value,
        current_value: d.current_value,
        difference: d.difference,
        percent_change: d.percent_change,
        is_reviewed: false,
      }))

      const { error: discrepanciesError } = await (supabaseServer
        .from('discrepancies') as any)
        .insert(discrepancyRecords)

      if (discrepanciesError) {
        console.error('Discrepancies insert error - Full error object:', discrepanciesError)
        console.error('Discrepancies insert error - Code:', discrepanciesError?.code)
        console.error('Discrepancies insert error - Message:', discrepanciesError?.message)
        console.error('Discrepancies insert error - Details:', discrepanciesError?.details)
        console.error('Number of discrepancies attempted to insert:', discrepancyRecords.length)
      }
    }

    return NextResponse.json({
      success: true,
      payrollPeriodId,
      employeeCount: parsed.totals.total_persons,
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
