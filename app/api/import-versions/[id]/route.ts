import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'
import { getPayrollReconciliationIssues } from '@/lib/payroll-reconciliation'
import { parsePaychexText } from '@/lib/pdf-parser'
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!cookies().get('payroll_session'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseServer
    .from('payroll_import_versions')
    .select('*')
    .eq('id', params.id)
    .single()
  return error
    ? NextResponse.json({ error: 'Version not found' }, { status: 404 })
    : NextResponse.json(data)
}
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!cookies().get('payroll_session'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { actor, expectedVersion } = await request.json()
    if (
      typeof actor !== 'string' ||
      !actor.trim() ||
      actor.length > 120 ||
      typeof expectedVersion !== 'string'
    )
      return NextResponse.json(
        { error: 'Your name and the active version are required.' },
        { status: 400 },
      )
    const { data: version, error: versionError } = await supabaseServer
      .from('payroll_import_versions')
      .select('payload')
      .eq('id', params.id)
      .single()
    if (versionError || !version)
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    const issues = getPayrollReconciliationIssues(
      parsePaychexText(version.payload.raw_text),
    )
    if (issues.length)
      return NextResponse.json(
        {
          error: 'The retained source no longer passes journal validation.',
          issues,
        },
        { status: 422 },
      )
    const { data, error } = await supabaseServer.rpc(
      'payroll_restore_version',
      {
        p_version_id: params.id,
        p_expected_version: expectedVersion,
        p_actor: actor,
      },
    )
    if (error)
      return NextResponse.json(
        {
          error: ['40001', 'PT409'].includes(error.code)
            ? 'Payroll changed. Refresh before restoring.'
            : error.code
              ? 'The restore failed and its transaction was rolled back.'
              : 'The restore could not be confirmed. Check History before trying again.',
        },
        { status: ['40001', 'PT409'].includes(error.code) ? 409 : 500 },
      )
    return NextResponse.json({ success: true, ...data })
  } catch {
    return NextResponse.json(
      { error: 'Restore failed; no payroll data was changed.' },
      { status: 500 },
    )
  }
}
