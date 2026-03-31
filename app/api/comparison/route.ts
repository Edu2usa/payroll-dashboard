import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'
import { checkApiAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('payroll_session')
    const apiKeyValid = checkApiAuth(request)
    
    if (!session && !apiKeyValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const periodId = searchParams.get('periodId')

    // Get the specified period and previous period
    const { data: currentPeriod } = await supabaseServer
      .from('payroll_periods')
      .select('*')
      .eq('id', periodId)
      .single()

    if (!currentPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    const { data: previousPeriods } = await supabaseServer
      .from('payroll_periods')
      .select('*')
      .lt('check_date', currentPeriod.check_date)
      .order('check_date', { ascending: false })
      .limit(2)

    if (!previousPeriods || previousPeriods.length === 0) {
      return NextResponse.json({
        current: currentPeriod,
        previous: [],
        entries: null,
      })
    }

    // Get entries for comparison
    const { data: currentEntries } = await supabaseServer
      .from('payroll_entries')
      .select('*')
      .eq('payroll_period_id', currentPeriod.id)

    const { data: previousEntries } = await supabaseServer
      .from('payroll_entries')
      .select('*')
      .eq('payroll_period_id', previousPeriods[0].id)

    return NextResponse.json({
      current: currentPeriod,
      previous: previousPeriods,
      currentEntries,
      previousEntries,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
