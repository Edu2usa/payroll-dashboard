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

    let query = supabaseServer
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('name')
      .limit(limit)

    if (search) {
      query = supabaseServer
        .from('employees')
        .select('*')
        .or(`last_name.ilike.%${search}%,first_name.ilike.%${search}%,employee_id.eq.${isNaN(parseInt(search)) ? -1 : parseInt(search)}`)
        .eq('is_active', true)
        .order('last_name,first_name')
        .limit(limit)
    } else {
      query = query.order('last_name,first_name')
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
