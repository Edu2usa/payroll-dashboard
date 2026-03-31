import { PayrollEntry, Employee } from './supabase'

export interface ParsedPayroll {
  period_start: string
  period_end: string
  check_date: string
  run_date: string
  employees: (Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { payroll_entry: Omit<PayrollEntry, 'id' | 'payroll_period_id' | 'employee_id' | 'created_at'> })[]
  totals: {
    total_hours: number
    total_earnings: number
    total_withholdings: number
    total_deductions: number
    total_persons: number
    total_transactions: number
    total_employer_liability: number
    total_tax_liability: number
    total_net_pay: number
  }
}

function parseDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.trim().split(/\s*\/\s*/)
  if (parts.length === 3) {
    const [m, d, y] = parts
    const year = y.length === 2 ? '20' + y : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return ''
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  return parseFloat(cleaned) || 0
}

interface EmployeeData {
  employee_id: number
  last_name: string
  first_name: string
  middle_initial: string
  department: number
  is_active: boolean
  first_seen: string
  last_seen: string
  payroll_entry: {
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
  }
}

function createEmployeeData(
  employee_id: number,
  last_name: string,
  first_name: string,
  middle_initial: string,
  department: number,
  period_start: string,
  period_end: string
): EmployeeData {
  return {
    employee_id,
    last_name,
    first_name,
    middle_initial,
    department,
    is_active: true,
    first_seen: period_start,
    last_seen: period_end,
    payroll_entry: {
      department,
      regular_hours: 0,
      regular_rate: 0,
      regular_earnings: 0,
      overtime_hours: 0,
      overtime_rate: 0,
      overtime_earnings: 0,
      double_time_hours: 0,
      double_time_rate: 0,
      double_time_earnings: 0,
      vacation_hours: 0,
      vacation_rate: 0,
      vacation_earnings: 0,
      total_hours: 0,
      total_earnings: 0,
      reimb_other_payments: 0,
      social_security: 0,
      medicare: 0,
      fed_income_tax: 0,
      ct_income_tax: 0,
      ct_pfl: 0,
      total_withholdings: 0,
      health_deduction: 0,
      simple_ira: 0,
      hsa: 0,
      loan_repayment: 0,
      other_deduction: 0,
      total_deductions: 0,
      net_pay: 0,
      direct_deposit_amount: 0,
      check_amount: 0,
      check_number: '',
    },
  }
}

export async function parsePaychexPDF(buffer: Buffer): Promise<ParsedPayroll> {
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  const lines = data.text.split('\n')

  let period_start = ''
  let period_end = ''
  let check_date = ''
  let run_date = ''

  // Extract header info from lines:
  // Line 35: "Run"
  // Line 36: "Date 01/16/26  12:57"
  // Line 37: "PM"
  // Line 38: "Period"
  // Line 39: "Start"
  // Line 40: "- End"
  // Line 41: "Date"
  // Line 42: "01/03/26"
  // Line 43: "- 01/16/26"
  // Line 46: "Check"
  // Line 47: "Date"
  // Line 48: "01/21/26"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // Look for "Date 01/16/26  12:57" pattern for run date
    if (line.match(/^Date\s+(\d{1,2}\/\d{1,2}\/\d{2})/)) {
      const match = line.match(/^Date\s+(\d{1,2}\/\d{1,2}\/\d{2})/)
      if (match) {
        run_date = parseDate(match[1])
      }
    }

    // Look for period start date on its own line: "01/03/26"
    if (line.match(/^(\d{1,2}\/\d{1,2}\/\d{2})$/) && !period_start) {
      // Check if next line is "- 01/16/26" pattern
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim()
        const match = nextLine.match(/^-\s*(\d{1,2}\/\d{1,2}\/\d{2})$/)
        if (match) {
          period_start = parseDate(line)
          period_end = parseDate(match[1])
        }
      }
    }

    // Look for check date: "Check" / "Date" / "01/21/26"
    if (line === 'Check' && i + 2 < lines.length) {
      if (lines[i + 1].trim() === 'Date') {
        const dateMatch = lines[i + 2].trim().match(/^(\d{1,2}\/\d{1,2}\/\d{2})/)
        if (dateMatch) {
          check_date = parseDate(dateMatch[1])
        }
      }
    }
  }

  // Use a two-pass approach:
  // Pass 1: Find all employees and their IDs
  // Pass 2: Parse payroll data for each employee

  const employeeMap: Map<string, { id: number; last: string; first: string; middle: string; department: number }> = new Map()
  const employeePayroll: Map<number, any> = new Map()

  let currentDepartment = 0

  // First pass: identify employees and create records
  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    // Detect department
    if (line.match(/^\*{4}\s*$/)) {
      if (i + 2 < lines.length) {
        const nextLine = lines[i + 1].trim()
        const deptMatch = nextLine.match(/^(\d+)\s+DEPARTMENT/)
        if (deptMatch) {
          const deptNumLine = lines[i + 2].trim()
          if (deptNumLine.match(/^\d+$/)) {
            currentDepartment = parseInt(deptNumLine)
          }
        }
      }
      i++
      continue
    }

    // Detect employee name pattern: "LastName," on its own line
    if (line.match(/^[A-Z][a-zA-Z]+,\s*$/)) {
      const lastName = line.replace(/,\s*$/, '')

      if (i + 1 < lines.length) {
        const firstNameLine = lines[i + 1].trim()
        let firstName = ''
        let middleInitial = ''

        if (firstNameLine.match(/^[A-Z][a-zA-Z]*\s*$/)) {
          firstName = firstNameLine
          if (i + 2 < lines.length) {
            const nextLine = lines[i + 2].trim()
            if (nextLine.match(/^[A-Z]\s*$/)) {
              middleInitial = nextLine
            }
          }
        } else if (firstNameLine.match(/^[A-Z][a-zA-Z]*\s+[A-Z]\s*$/)) {
          const parts = firstNameLine.split(/\s+/)
          firstName = parts[0]
          middleInitial = parts[1]
        }

        if (firstName) {
          // Look ahead for the employee ID (after deposit marker)
          let empId: number | null = null
          for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
            const checkLine = lines[j].trim()
            if (checkLine.match(/^#\s*\d+$/) && j + 1 < lines.length) {
              const nextCheckLine = lines[j + 1].trim()
              if (nextCheckLine.match(/^\d{1,4}$/)) {
                empId = parseInt(nextCheckLine)
                break
              }
            }
          }

          if (empId) {
            const nameKey = `${lastName}|${firstName}|${middleInitial}`
            employeeMap.set(nameKey, {
              id: empId,
              last: lastName,
              first: firstName,
              middle: middleInitial,
              department: currentDepartment,
            })

            if (!employeePayroll.has(empId)) {
              employeePayroll.set(empId, createEmployeeData(empId, lastName, firstName, middleInitial, currentDepartment, period_start, period_end))
            }
          }
        }
      }
    }

    i++
  }

  // Second pass: parse payroll fields
  const employees: Map<number, EmployeeData> = employeePayroll
  let currentEmployeeId: number | null = null
  let currentEmployeeName: { last: string; first: string; middle: string } | null = null

  i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    // Detect employee name to establish context
    if (line.match(/^[A-Z][a-zA-Z]+,\s*$/)) {
      const lastName = line.replace(/,\s*$/, '')

      if (i + 1 < lines.length) {
        const firstNameLine = lines[i + 1].trim()
        let firstName = ''
        let middleInitial = ''

        if (firstNameLine.match(/^[A-Z][a-zA-Z]*\s*$/)) {
          firstName = firstNameLine
          if (i + 2 < lines.length) {
            const nextLine = lines[i + 2].trim()
            if (nextLine.match(/^[A-Z]\s*$/)) {
              middleInitial = nextLine
            }
          }
        } else if (firstNameLine.match(/^[A-Z][a-zA-Z]*\s+[A-Z]\s*$/)) {
          const parts = firstNameLine.split(/\s+/)
          firstName = parts[0]
          middleInitial = parts[1]
        }

        if (firstName) {
          currentEmployeeName = { last: lastName, first: firstName, middle: middleInitial }
          // Now find the employee ID for this name
          for (const [empId, emp] of employees) {
            if (emp.last_name === lastName && emp.first_name === firstName && emp.middle_initial === middleInitial) {
              currentEmployeeId = empId
              break
            }
          }
        }
      }
    }

    // Detect employee ID to set context
    if (line.match(/^#\s*\d+$/) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim()
      if (nextLine.match(/^\d{1,4}$/)) {
        const empId = parseInt(nextLine)
        if (employees.has(empId)) {
          currentEmployeeId = empId
        }
      }
    }

    // Parse payroll fields for current employee
    if (currentEmployeeId && employees.has(currentEmployeeId)) {
      const emp = employees.get(currentEmployeeId)!
      const pe = emp.payroll_entry

      // Regular earnings: "Regular" -> rate -> hours -> earnings
      if (line === 'Regular' && i + 3 < lines.length) {
        const rate = parseNumber(lines[i + 1].trim())
        const hours = parseNumber(lines[i + 2].trim())
        const earnings = parseNumber(lines[i + 3].trim())
        pe.regular_rate = rate
        pe.regular_hours = hours
        pe.regular_earnings = earnings
        i += 3
      }
      // Overtime earnings: "Overtime" -> rate -> hours -> earnings
      else if (line === 'Overtime' && i + 3 < lines.length) {
        const rate = parseNumber(lines[i + 1].trim())
        const hours = parseNumber(lines[i + 2].trim())
        const earnings = parseNumber(lines[i + 3].trim())
        pe.overtime_rate = rate
        pe.overtime_hours = hours
        pe.overtime_earnings = earnings
        i += 3
      }
      // Double Time earnings
      else if (line === 'Double' && i + 4 < lines.length && lines[i + 1].trim() === 'Time') {
        const rate = parseNumber(lines[i + 2].trim())
        const hours = parseNumber(lines[i + 3].trim())
        const earnings = parseNumber(lines[i + 4].trim())
        pe.double_time_rate = rate
        pe.double_time_hours = hours
        pe.double_time_earnings = earnings
        i += 4
      }
      // Vacation earnings
      else if (line === 'Vacation' && i + 3 < lines.length) {
        const rate = parseNumber(lines[i + 1].trim())
        const hours = parseNumber(lines[i + 2].trim())
        const earnings = parseNumber(lines[i + 3].trim())
        pe.vacation_rate = rate
        pe.vacation_hours = hours
        pe.vacation_earnings = earnings
        i += 3
      }
      // Social Security: "Social" -> "Security" -> amount
      else if (line === 'Social' && i + 2 < lines.length && lines[i + 1].trim() === 'Security') {
        pe.social_security = parseNumber(lines[i + 2].trim())
        i += 2
      }
      // Medicare: "Medicare" -> amount
      else if (line === 'Medicare' && i + 1 < lines.length) {
        pe.medicare = parseNumber(lines[i + 1].trim())
        i += 1
      }
      // Fed Income Tax: "Fed" -> "Income" -> "Tax" -> amount
      else if (line === 'Fed' && i + 3 < lines.length && lines[i + 1].trim() === 'Income' && lines[i + 2].trim() === 'Tax') {
        pe.fed_income_tax = parseNumber(lines[i + 3].trim())
        i += 3
      }
      // CT Income Tax: "CT" -> "Income" -> "Tax" -> amount
      else if (line === 'CT' && i + 3 < lines.length && lines[i + 1].trim() === 'Income' && lines[i + 2].trim() === 'Tax') {
        pe.ct_income_tax = parseNumber(lines[i + 3].trim())
        i += 3
      }
      // CT PFL: "CT" -> "PFL" -> amount
      else if (line === 'CT' && i + 2 < lines.length && lines[i + 1].trim() === 'PFL') {
        pe.ct_pfl = parseNumber(lines[i + 2].trim())
        i += 2
      }
      // Health deduction: "Health" -> amount
      else if (line === 'Health' && i + 1 < lines.length) {
        pe.health_deduction = parseNumber(lines[i + 1].trim())
        i += 1
      }
      // Simple IRA: "SimpleIra" or "Simple" -> "Ira" -> amount
      else if (line === 'SimpleIra' && i + 1 < lines.length) {
        pe.simple_ira = parseNumber(lines[i + 1].trim())
        i += 1
      } else if (line === 'Simple' && i + 2 < lines.length && lines[i + 1].trim() === 'Ira') {
        pe.simple_ira = parseNumber(lines[i + 2].trim())
        i += 2
      }
      // HSA deduction: "HSA" -> amount
      else if (line === 'HSA' && i + 1 < lines.length) {
        pe.hsa = parseNumber(lines[i + 1].trim())
        i += 1
      }
      // Check: "Check" -> "Amt" -> amount
      else if (line === 'Check' && i + 2 < lines.length && lines[i + 1].trim() === 'Amt') {
        pe.check_amount = parseNumber(lines[i + 2].trim())
        i += 2
      }
      // Chkg (check number): "Chkg" -> check_number -> amount
      else if (line === 'Chkg' && i + 2 < lines.length) {
        pe.check_number = lines[i + 1].trim()
        pe.check_amount = parseNumber(lines[i + 2].trim())
        i += 2
      }
      // Net Pay: "Net" -> "Pay " -> amount
      else if (line === 'Net' && i + 2 < lines.length && lines[i + 1].trim().startsWith('Pay')) {
        pe.net_pay = parseNumber(lines[i + 2].trim())
        i += 2
      }
      // Employee Total: " EMPLOYEE" -> "TOTAL" -> hours -> earnings -> ... -> withholdings
      else if (line === 'EMPLOYEE' && i + 1 < lines.length && lines[i + 1].trim() === 'TOTAL') {
        if (i + 5 < lines.length) {
          const hours = parseNumber(lines[i + 2].trim())
          const earnings = parseNumber(lines[i + 3].trim())
          const withholdings = parseNumber(lines[i + 5].trim())
          pe.total_hours = hours
          pe.total_earnings = earnings
          pe.total_withholdings = withholdings
        }
        // Reset current employee after we finish
        currentEmployeeId = null
        i += 5
      }
    }

    i++
  }

  // Calculate totals
  let total_hours = 0
  let total_earnings = 0
  let total_withholdings = 0
  let total_deductions = 0
  let total_net_pay = 0

  employees.forEach((emp) => {
    const pe = emp.payroll_entry

    // Calculate totals if not already set
    if (pe.total_hours === 0) {
      pe.total_hours = (pe.regular_hours || 0) + (pe.overtime_hours || 0) + (pe.double_time_hours || 0) + (pe.vacation_hours || 0)
    }
    if (pe.total_earnings === 0) {
      pe.total_earnings = (pe.regular_earnings || 0) + (pe.overtime_earnings || 0) + (pe.double_time_earnings || 0) + (pe.vacation_earnings || 0)
    }
    if (pe.total_withholdings === 0) {
      pe.total_withholdings = (pe.social_security || 0) + (pe.medicare || 0) + (pe.fed_income_tax || 0) + (pe.ct_income_tax || 0) + (pe.ct_pfl || 0)
    }

    pe.total_deductions = (pe.health_deduction || 0) + (pe.simple_ira || 0) + (pe.hsa || 0) + (pe.loan_repayment || 0) + (pe.other_deduction || 0)

    if (pe.net_pay === 0) {
      pe.net_pay = pe.total_earnings - pe.total_withholdings - pe.total_deductions
    }

    total_hours += pe.total_hours
    total_earnings += pe.total_earnings
    total_withholdings += pe.total_withholdings
    total_deductions += pe.total_deductions
    total_net_pay += pe.net_pay
  })

  return {
    period_start,
    period_end,
    check_date,
    run_date,
    employees: Array.from(employees.values()),
    totals: {
      total_hours,
      total_earnings,
      total_withholdings,
      total_deductions,
      total_persons: employees.size,
      total_transactions: employees.size,
      total_employer_liability: 0,
      total_tax_liability: total_withholdings,
      total_net_pay,
    },
  }
}
