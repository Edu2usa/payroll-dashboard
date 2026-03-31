import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)

export type PayrollPeriod = {
  id: string
  period_start: string
  period_end: string
  check_date: string
  run_date: string
  total_gross: number
  total_net: number
  total_withholdings: number
  total_deductions: number
  employee_count: number
  status: string
  pdf_filename: string
  created_at: string
}

export type Employee = {
  id: string
  employee_id: string
  name: string
  department: number
  hourly_rate: number
  is_active: boolean
  first_seen: string
  last_seen: string
  created_at: string
}

export type PayrollEntry = {
  id: string
  payroll_period_id: string
  employee_id: string
  department: number
  regular_hours: number
  overtime_hours: number
  double_time_hours: number
  vacation_hours: number
  total_hours: number
  regular_earnings: number
  overtime_earnings: number
  double_time_earnings: number
  vacation_earnings: number
  total_earnings: number
  hourly_rate: number
  social_security: number
  medicare: number
  fed_income_tax: number
  ct_income_tax: number
  ct_pfl: number
  total_withholdings: number
  health_deduction: number
  simple_ira: number
  other_deductions: number
  total_deductions: number
  net_pay: number
  check_number: string
  direct_deposit_number: string
  created_at: string
}

export type Discrepancy = {
  id: string
  payroll_period_id: string
  employee_id: string
  type: string
  severity: string
  description: string
  previous_value: number | null
  current_value: number | null
  difference: number | null
  is_reviewed: boolean
  reviewed_at: string | null
  created_at: string
}
