import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'
import { getWorkspace } from '@/lib/workspace-data'
export async function POST(request: NextRequest) {
  if (!cookies().get('payroll_session'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id, actor, note, is_reviewed } = await request.json()
    if (
      typeof actor !== 'string' ||
      !actor.trim() ||
      actor.length > 120 ||
      typeof is_reviewed !== 'boolean' ||
      typeof note !== 'string' ||
      note.length > 2000
    )
      return NextResponse.json(
        { error: 'Enter your name and a note of up to 2,000 characters.' },
        { status: 400 },
      )
    const data = await getWorkspace()
    const alert = data.alerts.find((a: any) => a.id === id)
    const period = data.periods.find((p: any) => p.review_id === id)
    if (!alert && !period)
      return NextResponse.json(
        { error: 'This payroll changed. Refresh before reviewing.' },
        { status: 409 },
      )
    if (
      period &&
      is_reviewed &&
      (period.open_alerts || !period.reconciliation.matches)
    )
      return NextResponse.json(
        { error: 'Resolve the review items and journal mismatches first.' },
        { status: 409 },
      )
    const { error } = await supabaseServer
      .from('payroll_review_events')
      .insert({
        alert_id: id,
        payroll_period_id: alert?.current_period_id || period.id,
        actor: actor.trim(),
        note: note.trim(),
        is_reviewed,
        alert: alert || {
          type: 'period_review',
          version_id: period.active_version_id,
        },
      })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Review could not be saved. Please retry.' },
      { status: 500 },
    )
  }
}
