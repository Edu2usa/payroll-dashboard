import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { supabaseServer } from '@/lib/supabase'
import { parsePaychexPDF } from '@/lib/pdf-parser'
import { getPayrollReconciliationIssues } from '@/lib/payroll-reconciliation'
export async function POST(request: NextRequest) {
  if (!cookies().get('payroll_session'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const form = await request.formData(),
      file = form.get('file')
    if (!(file instanceof File) || file.size > 4 * 1024 * 1024 || !file.size)
      return NextResponse.json(
        { error: 'Choose a PDF up to 4 MB.' },
        { status: 400 },
      )
    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.subarray(0, 5).toString() !== '%PDF-')
      return NextResponse.json(
        { error: 'The file must be a PDF journal.' },
        { status: 400 },
      )
    const parsed = await parsePaychexPDF(buffer),
      issues = getPayrollReconciliationIssues(parsed)
    if (issues.length)
      return NextResponse.json(
        {
          error: 'The import does not match the journal. No data changed.',
          issues,
        },
        { status: 422 },
      )
    const { data: existing, error: readError } = await supabaseServer
      .from('payroll_periods')
      .select('id,active_version_id,total_earnings')
      .eq('period_start', parsed.period_start)
      .eq('period_end', parsed.period_end)
      .maybeSingle()
    if (readError) throw readError
    const hash = createHash('sha256').update(buffer).digest('hex')
    if (form.get('mode') === 'preview')
      return NextResponse.json({
        period_start: parsed.period_start,
        period_end: parsed.period_end,
        check_date: parsed.check_date,
        totals: parsed.totals,
        expectedVersion: existing?.active_version_id || null,
        previousGross: existing?.total_earnings ?? null,
        hash,
      })
    const actor = form.get('actor')
    if (
      typeof actor !== 'string' ||
      !actor.trim() ||
      actor.length > 120 ||
      !form.has('expectedVersion') ||
      form.get('hash') !== hash
    )
      return NextResponse.json(
        { error: 'Preview this file and enter your name before saving.' },
        { status: 400 },
      )
    const { data, error } = await supabaseServer.rpc('payroll_import_atomic', {
      p_payload: parsed,
      p_actor: actor,
      p_source: file.name,
      p_expected_version: form.get('expectedVersion') || null,
      p_reason: 'import',
    })
    if (error)
      return NextResponse.json(
        {
          error: ['40001', 'PT409'].includes(error.code)
            ? 'This payroll changed. Preview the file again.'
            : error.code
              ? 'The import failed and its transaction was rolled back.'
              : 'The save could not be confirmed. Check History before trying again.',
        },
        { status: ['40001', 'PT409'].includes(error.code) ? 409 : 500 },
      )
    return NextResponse.json({ success: true, ...data })
  } catch {
    return NextResponse.json(
      { error: 'The PDF could not be imported. No payroll data changed.' },
      { status: 500 },
    )
  }
}
