import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkApiAuth } from '@/lib/auth'
import { getWorkspace } from '@/lib/workspace-data'
export const dynamic = 'force-dynamic'
export async function GET(request: NextRequest) {
  if (!cookies().get('payroll_session') && !checkApiAuth(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await getWorkspace(), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not load payroll. Please retry.',
      },
      { status: 500 },
    )
  }
}
