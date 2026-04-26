import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'
import { checkApiAuth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('payroll_session')
    const apiKeyValid = checkApiAuth(request)
    
    if (!session && !apiKeyValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: period, error: periodError } = await supabaseServer
      .from('payroll_periods')
      .select('*')
      .eq('id', params.id)
      .single()

    const periodRecord = period as any

    if (periodError || !periodRecord) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { data: entries, error: entriesError } = await supabaseServer
      .from('payroll_entries')
      .select('*')
      .eq('payroll_period_id', params.id)

    if (entriesError) {
      return NextResponse.json({ error: entriesError.message }, { status: 500 })
    }

    return NextResponse.json({ ...periodRecord, entries })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
