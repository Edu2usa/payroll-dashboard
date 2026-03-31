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
    const limit = parseInt(searchParams.get('limit') || '100')
    const search = searchParams.get('search')

    // Sanitize search input to prevent filter injection
    const sanitizedSearch = search ? search.replace(/[%_\\]/g, '\\$&') : null

    let query = supabaseServer
      .from('employees')
      .select('*')
      .eq('is_active', true)

    if (sanitizedSearch) {
      const empIdNum = parseInt(sanitizedSearch)
      const empIdFilter = isNaN(empIdNum) ? -1 : empIdNum
      query = query.or(`last_name.ilike.%${sanitizedSearch}%,first_name.ilike.%${sanitizedSearch}%,employee_id.eq.${empIdFilter}`)
    }

    query = query
      .order('last_name')
      .order('first_name')
      .limit(limit)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
