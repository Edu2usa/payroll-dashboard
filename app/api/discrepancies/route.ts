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
    const reviewed = searchParams.get('reviewed')
    const severity = searchParams.get('severity')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabaseServer
      .from('discrepancies')
      .select('*, employees(*), payroll_periods(*)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (reviewed !== null) {
      query = supabaseServer
        .from('discrepancies')
        .select('*, employees(*), payroll_periods(*)')
        .eq('is_reviewed', reviewed === 'true')
        .order('created_at', { ascending: false })
        .limit(limit)
    }

    if (severity) {
      query = supabaseServer
        .from('discrepancies')
        .select('*, employees(*), payroll_periods(*)')
        .eq('severity', severity)
        .order('created_at', { ascending: false })
        .limit(limit)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
