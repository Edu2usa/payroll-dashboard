import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkApiAuth } from '@/lib/auth'
import { getWorkspace } from '@/lib/workspace-data'
export async function GET(request: NextRequest) {
  if (!cookies().get('payroll_session') && !checkApiAuth(request))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await getWorkspace(),
      q = request.nextUrl.searchParams
    const result = data.alerts.filter(
      (a: any) =>
        (!q.has('reviewed') ||
          a.is_reviewed === (q.get('reviewed') === 'true')) &&
        (!q.get('severity') || a.severity === q.get('severity')) &&
        (!q.get('periodId') || a.current_period_id === q.get('periodId')),
    )
    const limit = Math.min(1000, Math.max(1, Number(q.get('limit')) || 100))
    return NextResponse.json(
      result.slice(0, limit).map((a: any) => ({
        ...a,
        employees: data.employees.find((e: any) => e.id === a.employee_id),
        payroll_periods: data.periods.find(
          (p: any) => p.id === a.current_period_id,
        ),
      })),
    )
  } catch {
    return NextResponse.json(
      { error: 'Could not load review items.' },
      { status: 500 },
    )
  }
}
