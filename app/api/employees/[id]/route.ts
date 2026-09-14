import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'
import { checkApiAuth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('payroll_session')
    const apiKeyValid = checkApiAuth(request)

    if (!session && !apiKeyValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: employee, error: empError } = await supabaseServer
      .from('employees')
      .select('*')
      .eq('id', params.id)
      .single()

    const employeeRecord = employee as any

    if (empError || !employeeRecord) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: entries, error: entriesError } = await supabaseServer
      .from('payroll_entries')
      .select('*, payroll_periods!inner(id,period_start,period_end,check_date)')
      .eq('employee_id', params.id)
      .order('payroll_periods(period_end)', { ascending: false })
      .range(
        Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0),
        Math.max(0, Number(request.nextUrl.searchParams.get('offset')) || 0) +
          99,
      )

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    return NextResponse.json({ ...employeeRecord, entries })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
