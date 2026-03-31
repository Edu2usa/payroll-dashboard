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
  company_id: string
  total_persons: number
  total_transactions: number
  total_hours: number
  total_earnings: number
  total_withholdings: number
  total_deductions: number
  total_employer_liability: number
  total_tax_liability: number
  total_net_pay: number
  raw_text: string | null
  created_at: string
  updated_at: string
}

export type Employee = {
  id: string
  employee_id: number
  last_name: string
  first_name: string
  middle_initial: string
  department: number
  is_active: boolean
  first_seen: string
  last_seen: string
  created_at: string
  updated_at: string
}

export type PayrollEntry = {
  id: string
  payroll_period_id: string
  employee_id: string
  department: number
  regular_hours: number
  regular_rate: number
  regular_earnings: number
  overtime_hours: number
  overtime_rate: number
  overtime_earnings: number
  double_time_hours: number
  double_time_rate: number
  double_time_earnings: number
  vacation_hours: number
  vacation_rate: number
  vacation_earnings: number
  total_hours: number
  total_earnings: number
  reimb_other_payments: number
  social_security: number
  medicare: number
  fed_income_tax: number
  ct_income_tax: number
  ct_pfl: number
  total_withholdings: number
  health_deduction: number
  simple_ira: number
  hsa: number
  loan_repayment: number
  other_deduction: number
  total_deductions: number
  net_pay: number
  direct_deposit_amount: number
  check_amount: number
  check_number: string
  created_at: string
}

export type Discrepancy = {
  id: string
  employee_id: string
  current_period_id: string
  previous_period_id: string | null
  type: string
  field: string
  previous_value: number | null
  current_value: number | null
  difference: number | null
  percent_change: number | null
  severity: string
  notes: string | null
  is_reviewed: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}
