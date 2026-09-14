import { supabaseServer, PayrollEntry } from './supabase'
import { buildAlerts, PayrollAlert } from './payroll-alerts'
export type DetectedDiscrepancy = PayrollAlert
export async function detectDiscrepancies(id: string, entries: PayrollEntry[]) {
  const { data: current, error } = await supabaseServer
    .from('payroll_periods')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !current) throw new Error('Could not load the current period')
  const { data: periods, error: periodError } = await supabaseServer
    .from('payroll_periods')
    .select('*')
    .lt('period_end', current.period_end)
    .order('period_end', { ascending: false })
    .limit(1)
  if (periodError) throw periodError
  const previous = periods?.[0] || null
  const result = previous
    ? await supabaseServer
        .from('payroll_entries')
        .select('*')
        .eq('payroll_period_id', previous.id)
    : { data: [], error: null }
  if (result.error) throw result.error
  return buildAlerts(current, previous, entries, result.data || [])
}
