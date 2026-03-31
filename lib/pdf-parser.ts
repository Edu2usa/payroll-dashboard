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
  if (!value) return 0
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
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

function createEmptyPayrollEntry(department: number) {
  return {
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
  }
}

// Check if a line is part of a page header (skip these)
function isPageHeader(line: string): boolean {
  return (
    line.match(/^0940\s/) !== null ||
    line === 'Preferred' ||
    line === 'Maintenance' ||
    line.match(/^Inc\s*$/) !== null ||
    line === 'EMPLOYEE' ||
    line === 'NAME' ||
    line === 'HOURS,' ||
    line === 'EARNINGS,' ||
    line === 'REIMBURSEMENTS' ||
    line === '& OTHER' ||
    line === 'PAYMENTS' ||
    line === 'WITHHOLDINGS' ||
    line === 'DEDUCTIONS' ||
    line === 'NET' ||
    line === 'PAY' ||
    line === 'ID' ||
    line === 'HOURS' ||
    line === 'EARNINGS' ||
    line === 'REIMB' ||
    line === 'ALLOCATIONS' ||
    line === 'DESCRIPTION' ||
    line === 'RATE' ||
    line === 'PAYROLL' ||
    line.match(/^JOURNAL\s*$/) !== null ||
    line === '(Prior' ||
    line === 'to' ||
    line === 'Processing)' ||
    line === 'PYRJRN' ||
    line.match(/^Page \d+/) !== null ||
    line.match(/^of \d+/) !== null ||
    line === 'Run' ||
    line === 'Period' ||
    line === 'Start' ||
    line === '- End' ||
    line === 'PM'
  )
}

export async function parsePaychexPDF(buffer: Buffer): Promise<ParsedPayroll> {
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  const rawLines = data.text.split('\n')
  const lines = rawLines.map((l: string) => l.trim())

  // ========== Phase 1: Extract header dates ==========
  let period_start = ''
  let period_end = ''
  let check_date = ''
  let run_date = ''

  for (let i = 0; i < Math.min(200, lines.length); i++) {
    const line = lines[i]
    const runMatch = line.match(/^Date\s+(\d{1,2}\/\d{1,2}\/\d{2})/)
    if (runMatch && !run_date) {
      run_date = parseDate(runMatch[1])
    }
    if (line.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/) && !period_start && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      const endMatch = nextLine.match(/^-\s*(\d{1,2}\/\d{1,2}\/\d{2})$/)
      if (endMatch) {
        period_start = parseDate(line)
        period_end = parseDate(endMatch[1])
      }
    }
    if (line === 'Check' && i + 2 < lines.length && lines[i + 1] === 'Date') {
      const dateMatch = lines[i + 2].match(/^\d{1,2}\/\d{1,2}\/\d{2}/)
      if (dateMatch && !check_date) {
        check_date = parseDate(dateMatch[0])
      }
    }
  }

  // ========== Phase 2: Find EMPLOYEE TOTAL blocks to segment employees ==========
  // Strategy: Find each employee by locating "# Unknown" (or "# <num>") + ID
  // and "(cont.)" + ID markers, then parse everything between markers.

  const employees: Map<number, EmployeeData> = new Map()
  let currentDepartment = 1
  let currentEmpId: number | null = null
  let inCompanyTotals = false

  // Track what field context we're in for combined-line parsing
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Skip empty lines
    if (!line || line.match(/^\s*$/)) {
      i++
      continue
    }

    // ---- Detect COMPANY TOTALS section ----
    if (line === 'COMPANY' && i + 1 < lines.length && lines[i + 1] === 'TOTALS') {
      inCompanyTotals = true
      currentEmpId = null
      i++
      continue
    }

    if (inCompanyTotals) {
      i++
      continue
    }

    // ---- Detect department ----
    if (line.match(/^\*{3,}\s*$/) || line.match(/^\*{3,}$/)) {
      // Look ahead for department info
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const deptMatch = lines[j].match(/^(\d+)\s+DEPARTMENT/)
        if (deptMatch) {
          // Next line after "N DEPARTMENT" might have the department number or "N (cont.)"
          if (j + 1 < lines.length) {
            const deptNumLine = lines[j + 1]
            const numMatch = deptNumLine.match(/^(\d+)/)
            if (numMatch) {
              currentDepartment = parseInt(numMatch[1])
            }
          }
          break
        }
      }
      i++
      continue
    }

    // Also handle inline department: "1 DEPARTMENT" followed by "1" or "1 (cont.)"
    const inlineDeptMatch = line.match(/^(\d+)\s+DEPARTMENT$/)
    if (inlineDeptMatch && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      const numMatch = nextLine.match(/^(\d+)/)
      if (numMatch) {
        currentDepartment = parseInt(numMatch[1])
      }
      i++
      continue
    }

    // ---- Detect employee ID via "# Unknown" or "# <number>" ----
    if (line.match(/^#\s*(Unknown|\d+)$/) && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      if (nextLine.match(/^\d{1,4}$/)) {
        const empId = parseInt(nextLine)
        currentEmpId = empId

        if (!employees.has(empId)) {
          // New employee - find their name by looking backwards
          const nameInfo = findEmployeeName(lines, i)
          employees.set(empId, {
            employee_id: empId,
            last_name: nameInfo.lastName,
            first_name: nameInfo.firstName,
            middle_initial: nameInfo.middleInitial,
            department: currentDepartment,
            is_active: true,
            first_seen: period_start,
            last_seen: period_end,
            payroll_entry: createEmptyPayrollEntry(currentDepartment),
          })
        }
        i += 2
        continue
      }
    }

    // ---- Detect continuation employee ----
    if (line === '(cont.)' && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      if (nextLine.match(/^\d{1,4}$/)) {
        const empId = parseInt(nextLine)
        currentEmpId = empId
        i += 2
        continue
      }
    }

    // ---- Detect EMPLOYEE TOTAL ----
    if (line === 'EMPLOYEE' && i + 1 < lines.length && lines[i + 1] === 'TOTAL') {
      if (currentEmpId && employees.has(currentEmpId)) {
        const emp = employees.get(currentEmpId)!
        const pe = emp.payroll_entry
        // Parse EMPLOYEE TOTAL values: TOTAL -> [hours] -> earnings -> [space] -> withholdings -> [deductions] -> Net Pay -> amount
        // Note: salaried employees have no hours line
        let j = i + 2

        // Collect all numbers (and their raw strings) before "Net" "Pay"
        const totalNumbers: { raw: string; val: number }[] = []
        while (j < lines.length) {
          const val = lines[j]
          if (!val || val.match(/^\s*$/)) { j++; continue }
          if (val === 'Net') break
          if (val.match(/^[\d,.]+$/)) {
            totalNumbers.push({ raw: val, val: parseNumber(val) })
          }
          j++
        }

        // Determine if first number is hours or earnings
        // Hours have 4 decimal places in the raw string (e.g., "80.0000"), earnings have 2 (e.g., "1,520.00")
        if (totalNumbers.length >= 2) {
          const firstRaw = totalNumbers[0].raw
          const decimalPart = firstRaw.includes('.') ? firstRaw.split('.')[1] : ''
          const isHours = decimalPart.length >= 4

          if (isHours) {
            pe.total_hours = totalNumbers[0].val
            pe.total_earnings = totalNumbers[1].val
            if (totalNumbers.length >= 3) pe.total_withholdings = totalNumbers[2].val
            if (totalNumbers.length >= 4) pe.total_deductions = totalNumbers[3].val
          } else {
            // Salaried: no hours, first number is earnings
            pe.total_earnings = totalNumbers[0].val
            if (totalNumbers.length >= 2) pe.total_withholdings = totalNumbers[1].val
            if (totalNumbers.length >= 3) pe.total_deductions = totalNumbers[2].val
          }
        } else if (totalNumbers.length === 1) {
          pe.total_earnings = totalNumbers[0].val
        }

        // Find Net Pay in the EMPLOYEE TOTAL block
        if (j < lines.length && lines[j] === 'Net' && j + 1 < lines.length && lines[j + 1].match(/^Pay/)) {
          if (j + 2 < lines.length) {
            pe.net_pay = parseNumber(lines[j + 2])
          }
          j += 3
        }
      }
      currentEmpId = null
      i += 2
      continue
    }

    // ---- Detect CHECK N TOTAL (for multi-check employees) ----
    if (line === 'CHECK' && i + 1 < lines.length && lines[i + 1].match(/^\d+\s+TOTAL$/)) {
      // Skip CHECK TOTAL block - the EMPLOYEE TOTAL will have the final aggregated values
      // But we need to skip past this block
      let j = i + 2
      // Skip values until we hit the next employee data or another marker
      while (j < lines.length) {
        if (lines[j] === 'Net' && j + 1 < lines.length && lines[j + 1].match(/^Pay/)) {
          j += 3 // skip Net Pay <amount>
          break
        }
        j++
        if (j - i > 20) break // safety
      }
      i = j
      continue
    }

    // ---- Parse payroll fields for current employee ----
    if (currentEmpId && employees.has(currentEmpId)) {
      const emp = employees.get(currentEmpId)!
      const pe = emp.payroll_entry

      // Skip page headers
      if (isPageHeader(line)) {
        i++
        continue
      }

      // Regular earnings: "Regular" -> rate -> hours -> earnings
      // Note: salaried employees may have empty rate/hours: "Regular" -> "" -> "" -> earnings
      if (line === 'Regular') {
        const vals = collectNextNumbers(lines, i + 1, 3)
        if (vals.count === 3) {
          pe.regular_rate = vals.numbers[0]
          pe.regular_hours = vals.numbers[1]
          pe.regular_earnings = vals.numbers[2]
        } else if (vals.count === 1) {
          // Salaried - just earnings
          pe.regular_earnings = vals.numbers[0]
        } else if (vals.count === 2) {
          // Could be rate + earnings or hours + earnings
          pe.regular_hours = vals.numbers[0]
          pe.regular_earnings = vals.numbers[1]
        }
        i++
        continue
      }

      // Overtime: "Overtime" -> rate -> hours -> earnings
      if (line === 'Overtime') {
        const vals = collectNextNumbers(lines, i + 1, 3)
        if (vals.count >= 3) {
          pe.overtime_rate = vals.numbers[0]
          pe.overtime_hours = vals.numbers[1]
          pe.overtime_earnings = vals.numbers[2]
        }
        i++
        continue
      }

      // Double Time: "Double" -> "Time" -> rate -> hours -> earnings
      if (line === 'Double' && i + 1 < lines.length && lines[i + 1] === 'Time') {
        const vals = collectNextNumbers(lines, i + 2, 3)
        if (vals.count >= 3) {
          pe.double_time_rate = vals.numbers[0]
          pe.double_time_hours = vals.numbers[1]
          pe.double_time_earnings = vals.numbers[2]
        }
        i += 2
        continue
      }

      // Vacation: "Vacation" -> rate -> hours -> earnings
      if (line === 'Vacation') {
        const vals = collectNextNumbers(lines, i + 1, 3)
        if (vals.count >= 3) {
          pe.vacation_rate = vals.numbers[0]
          pe.vacation_hours = vals.numbers[1]
          pe.vacation_earnings = vals.numbers[2]
        } else if (vals.count === 1) {
          pe.vacation_earnings = vals.numbers[0]
        }
        i++
        continue
      }

      // ---- Withholdings ----
      // Social Security: may be "Social Security" on one line, or "Social" + "Security" on two
      // Amount may be on its own line or combined: "94.24 Health" or "94.24 HSA"
      if (line === 'Social Security' || (line === 'Social' && i + 1 < lines.length && lines[i + 1] === 'Security')) {
        const ssLineOffset = line === 'Social Security' ? 1 : 2
        if (i + ssLineOffset < lines.length) {
          const valLine = lines[i + ssLineOffset]
          const combined = parseCombinedLine(valLine)
          pe.social_security += combined.value
          if (combined.label) {
            applyDeductionLabel(pe, combined.label, lines, i + ssLineOffset + 1)
          }
        }
        i += ssLineOffset
        continue
      }

      // Medicare: amount may be combined "23.23 Simple"
      if (line === 'Medicare') {
        if (i + 1 < lines.length) {
          const valLine = lines[i + 1]
          const combined = parseCombinedLine(valLine)
          pe.medicare += combined.value
          if (combined.label) {
            applyDeductionLabel(pe, combined.label, lines, i + 2)
          }
        }
        i++
        continue
      }

      // Fed Income Tax: "Fed Income Tax" or "Fed" + "Income" + "Tax"
      if (line === 'Fed Income Tax') {
        if (i + 1 < lines.length) pe.fed_income_tax += parseNumber(lines[i + 1])
        i++
        continue
      }
      if (line === 'Fed' && i + 2 < lines.length && lines[i + 1] === 'Income' && lines[i + 2] === 'Tax') {
        if (i + 3 < lines.length) pe.fed_income_tax += parseNumber(lines[i + 3])
        i += 3
        continue
      }

      // CT Income Tax: "CT Income Tax" or "CT" + "Income" + "Tax"
      if (line === 'CT Income Tax') {
        if (i + 1 < lines.length) pe.ct_income_tax += parseNumber(lines[i + 1])
        i++
        continue
      }
      if (line === 'CT' && i + 2 < lines.length && lines[i + 1] === 'Income' && lines[i + 2] === 'Tax') {
        if (i + 3 < lines.length) pe.ct_income_tax += parseNumber(lines[i + 3])
        i += 3
        continue
      }

      // CT PFL or CT PFML: "CT PFL" or "CT" + "PFL" or "CT" + "PFML"
      if (line === 'CT PFL' || line === 'CT PFML') {
        if (i + 1 < lines.length) pe.ct_pfl += parseNumber(lines[i + 1])
        i++
        continue
      }
      if (line === 'CT' && i + 1 < lines.length && (lines[i + 1] === 'PFL' || lines[i + 1] === 'PFML')) {
        if (i + 2 < lines.length) pe.ct_pfl += parseNumber(lines[i + 2])
        i += 2
        continue
      }

      // ---- Deductions ----
      // Health deduction: "Health" -> amount
      if (line === 'Health') {
        if (i + 1 < lines.length) pe.health_deduction += parseNumber(lines[i + 1])
        i++
        continue
      }

      // Deduction (generic): "Deduction" -> amount
      if (line === 'Deduction') {
        if (i + 1 < lines.length) pe.other_deduction += parseNumber(lines[i + 1])
        i++
        continue
      }

      // Simple IRA: "SimpleIra" or "Simple" + "Ira"
      if (line === 'SimpleIra') {
        if (i + 1 < lines.length) pe.simple_ira += parseNumber(lines[i + 1])
        i++
        continue
      }
      if (line === 'Simple' && i + 1 < lines.length && lines[i + 1] === 'Ira') {
        if (i + 2 < lines.length) pe.simple_ira += parseNumber(lines[i + 2])
        i += 2
        continue
      }
      // Handle "Ira" alone (after Simple was on the combined line with Medicare)
      if (line === 'Ira') {
        if (i + 1 < lines.length) pe.simple_ira += parseNumber(lines[i + 1])
        i++
        continue
      }

      // HSA: "HSA" -> possibly "EE" -> possibly account -> amount
      if (line === 'HSA') {
        // Look for amount: skip "EE" and account number lines
        let j = i + 1
        if (j < lines.length && lines[j] === 'EE') j++
        // Skip potential account number (3-4 digits)
        if (j < lines.length && lines[j].match(/^\d{2,4}$/)) j++
        if (j < lines.length) pe.hsa += parseNumber(lines[j])
        i++
        continue
      }

      // Loan Repayment: "Loan" + "Repay" or "Loan Repay" or "Loan" + "Repayment"
      if (line === 'Loan' && i + 1 < lines.length && lines[i + 1].match(/^Repay/)) {
        // Skip year line if present (e.g. "2026")
        let j = i + 2
        if (j < lines.length && lines[j].match(/^\d{4}$/)) j++
        if (j < lines.length) pe.loan_repayment += parseNumber(lines[j])
        i += 2
        continue
      }

      // ---- Payment info ----
      // Check Amt: "Check" + "Amt" -> amount
      if (line === 'Check' && i + 1 < lines.length && lines[i + 1] === 'Amt') {
        if (i + 2 < lines.length) pe.check_amount = parseNumber(lines[i + 2])
        i += 2
        continue
      }

      // Chkg: "Chkg" -> check_number -> amount
      if (line === 'Chkg') {
        if (i + 1 < lines.length) pe.check_number = lines[i + 1]
        if (i + 2 < lines.length) pe.direct_deposit_amount = parseNumber(lines[i + 2])
        i += 2
        continue
      }

      // Net Pay within employee data (not EMPLOYEE TOTAL): "Net" + "Pay" -> amount
      if (line === 'Net' && i + 1 < lines.length && lines[i + 1].match(/^Pay/)) {
        // Don't override - EMPLOYEE TOTAL will set the final value
        i += 2
        continue
      }
    }

    i++
  }

  // ========== Phase 3: Parse COMPANY TOTALS for accurate summary ==========
  let companyTotals = {
    total_persons: 0,
    total_transactions: 0,
    total_hours: 0,
    total_earnings: 0,
    total_withholdings: 0,
    total_deductions: 0,
    total_net_pay: 0,
    total_employer_liability: 0,
    total_tax_liability: 0,
  }

  // Find COMPANY TOTALS section
  for (let ci = 0; ci < lines.length; ci++) {
    if (lines[ci] === 'COMPANY' && ci + 1 < lines.length && lines[ci + 1] === 'TOTALS') {
      // Parse: "77" -> "Person(s)" -> "82" -> "Transaction(s)"
      let j = ci + 2
      while (j < lines.length) {
        if (lines[j].match(/^\d+$/) && j + 1 < lines.length && lines[j + 1] === 'Person(s)') {
          companyTotals.total_persons = parseInt(lines[j])
          j += 2
          continue
        }
        if (lines[j].match(/^\d+$/) && j + 1 < lines.length && lines[j + 1] === 'Transaction(s)') {
          companyTotals.total_transactions = parseInt(lines[j])
          j += 2
          continue
        }
        if (lines[j] === 'COMPANY TOTAL') {
          // Next line is total hours, then total earnings
          if (j + 1 < lines.length) companyTotals.total_hours = parseNumber(lines[j + 1])
          if (j + 2 < lines.length) companyTotals.total_earnings = parseNumber(lines[j + 2])
          // Skip space, then withholdings
          let k = j + 3
          while (k < lines.length && (!lines[k] || lines[k].match(/^\s*$/))) k++
          if (k < lines.length) companyTotals.total_withholdings = parseNumber(lines[k])
          k++
          while (k < lines.length && (!lines[k] || lines[k].match(/^\s*$/))) k++
          if (k < lines.length && lines[k].match(/^[\d,.]+$/)) {
            companyTotals.total_deductions = parseNumber(lines[k])
          }
          break
        }
        // Look for "Dir Dep**" followed by net pay amount
        if (lines[j].match(/^Dir$/) && j + 1 < lines.length && lines[j + 1].match(/^Dep\*\*/)) {
          if (j + 2 < lines.length) companyTotals.total_net_pay = parseNumber(lines[j + 2])
          j += 3
          continue
        }
        // Net Pay line in company totals
        if (lines[j] === 'Net' && j + 1 < lines.length && lines[j + 1] === 'Pay') {
          if (j + 2 < lines.length) companyTotals.total_net_pay = parseNumber(lines[j + 2])
          break
        }
        j++
      }
      break
    }

    // TOTAL EMPLOYER LIABILITY
    if (lines[ci] === 'TOTAL EMPLOYER LIABILITY' || lines[ci].match(/TOTAL EMPLOYER LIABILITY/)) {
      if (ci + 1 < lines.length) companyTotals.total_employer_liability = parseNumber(lines[ci + 1])
    }
    // TOTAL TAX LIABILITY
    if (lines[ci] === 'TOTAL TAX LIABILITY' || lines[ci].match(/TOTAL TAX LIABILITY/)) {
      if (ci + 1 < lines.length) companyTotals.total_tax_liability = parseNumber(lines[ci + 1])
    }
  }

  // Also look for employer/tax liability outside company totals section
  for (let ci = 0; ci < lines.length; ci++) {
    if (lines[ci].match(/TOTAL EMPLOYER LIABILITY/)) {
      if (ci + 1 < lines.length) companyTotals.total_employer_liability = parseNumber(lines[ci + 1])
    }
    if (lines[ci].match(/TOTAL TAX LIABILITY/)) {
      // The value might be on the next non-empty line
      let j = ci + 1
      while (j < lines.length && (!lines[j] || lines[j].match(/^\s*$/))) j++
      if (j < lines.length) companyTotals.total_tax_liability = parseNumber(lines[j])
    }
  }

  // ========== Phase 4: Calculate derived fields for each employee ==========
  employees.forEach((emp) => {
    const pe = emp.payroll_entry

    // If EMPLOYEE TOTAL didn't set total_hours, calculate from components
    if (pe.total_hours === 0) {
      pe.total_hours = pe.regular_hours + pe.overtime_hours + pe.double_time_hours + pe.vacation_hours
    }

    // If EMPLOYEE TOTAL didn't set total_earnings, calculate from components
    if (pe.total_earnings === 0) {
      pe.total_earnings = pe.regular_earnings + pe.overtime_earnings + pe.double_time_earnings + pe.vacation_earnings
    }

    // If EMPLOYEE TOTAL didn't set total_withholdings, calculate
    if (pe.total_withholdings === 0) {
      pe.total_withholdings = pe.social_security + pe.medicare + pe.fed_income_tax + pe.ct_income_tax + pe.ct_pfl
    }

    // Calculate total_deductions from components
    const calcDeductions = pe.health_deduction + pe.simple_ira + pe.hsa + pe.loan_repayment + pe.other_deduction
    if (pe.total_deductions === 0 && calcDeductions > 0) {
      pe.total_deductions = calcDeductions
    }

    // If net_pay not set from EMPLOYEE TOTAL, calculate it
    if (pe.net_pay === 0) {
      pe.net_pay = pe.total_earnings - pe.total_withholdings - pe.total_deductions
    }
  })

  // ========== Phase 5: Build result ==========
  // Use COMPANY TOTALS for the summary (most accurate), fall back to calculated
  let calc_total_hours = 0
  let calc_total_earnings = 0
  let calc_total_withholdings = 0
  let calc_total_deductions = 0
  let calc_total_net_pay = 0

  employees.forEach((emp) => {
    const pe = emp.payroll_entry
    calc_total_hours += pe.total_hours
    calc_total_earnings += pe.total_earnings
    calc_total_withholdings += pe.total_withholdings
    calc_total_deductions += pe.total_deductions
    calc_total_net_pay += pe.net_pay
  })

  console.log(`[PDF Parser] Found ${employees.size} employees`)
  console.log(`[PDF Parser] Company totals from PDF: ${companyTotals.total_persons} persons, $${companyTotals.total_earnings} earnings, $${companyTotals.total_net_pay} net pay`)
  console.log(`[PDF Parser] Calculated totals: $${calc_total_earnings.toFixed(2)} earnings, $${calc_total_net_pay.toFixed(2)} net pay`)

  return {
    period_start,
    period_end,
    check_date,
    run_date,
    employees: Array.from(employees.values()),
    totals: {
      total_hours: companyTotals.total_hours || calc_total_hours,
      total_earnings: companyTotals.total_earnings || calc_total_earnings,
      total_withholdings: companyTotals.total_withholdings || calc_total_withholdings,
      total_deductions: companyTotals.total_deductions || calc_total_deductions,
      total_persons: companyTotals.total_persons || employees.size,
      total_transactions: companyTotals.total_transactions || employees.size,
      total_employer_liability: companyTotals.total_employer_liability,
      total_tax_liability: companyTotals.total_tax_liability,
      total_net_pay: companyTotals.total_net_pay || calc_total_net_pay,
    },
  }
}

// ========== Helper: Find employee name by looking backwards from "# Unknown" position ==========
function findEmployeeName(lines: string[], unknownLineIdx: number): { lastName: string; firstName: string; middleInitial: string } {
  // The name appears before the payroll data. Look backwards from "# Unknown" to find it.
  // The name block is above the first payroll field (Regular, Overtime, Social Security, Direct, etc.)
  // We need to find lines that look like name parts.

  let lastName = ''
  let firstName = ''
  let middleInitial = ''

  // Look backwards for "Direct" + "Deposit" to find start of deposit block
  // Then look before that for payroll fields, then before that for name
  let searchStart = unknownLineIdx - 1

  // Walk back past Direct/Deposit and payroll fields to find name
  // The name is typically 2-4 lines before the first payroll field
  // Strategy: collect non-numeric, non-header, non-field lines going backwards until we
  // hit a known boundary (EMPLOYEE TOTAL, page header marker, department marker, etc.)

  const fieldLabels = new Set([
    'Regular', 'Overtime', 'Double', 'Time', 'Vacation',
    'Social', 'Security', 'Social Security', 'Medicare',
    'Fed', 'Income', 'Tax', 'Fed Income Tax',
    'CT', 'PFL', 'PFML', 'CT Income Tax', 'CT PFL', 'CT PFML',
    'Health', 'SimpleIra', 'Simple', 'Ira', 'HSA',
    'Direct', 'Deposit', 'Check', 'Amt', 'Chkg', 'Net',
    'Deduction', 'Loan', 'Repay', 'EE',
    'Pay', 'Date', 'Dir', 'Dep**',
  ])

  const nameLines: string[] = []

  for (let j = searchStart; j >= Math.max(0, unknownLineIdx - 30); j--) {
    const l = lines[j]
    if (!l || l.match(/^\s*$/)) continue

    // Stop at known boundaries
    if (l === 'TOTAL' || l === 'EMPLOYEE' || l === 'PYRJRN' || l === 'COMPANY') break
    if (l.match(/^(CHECK|\*{3,}|\d+ DEPARTMENT|Page \d+|of \d+)$/)) break
    if (l.match(/^0940\s/)) break
    if (l === '(cont.)') break
    // Stop at department continuation markers like "1 (cont.)" or "2 (cont.)"
    if (l.match(/^\d+\s*\(cont\.\)$/)) break

    // Stop if it's a pure number (part of previous employee's data)
    if (l.match(/^[\d,.]+$/) && !l.match(/,\s*$/)) continue

    // Stop if it's a known field label
    if (fieldLabels.has(l)) continue
    // Stop if it starts with "Pay" (from "Net Pay" context)
    if (l.match(/^Pay\s*$/)) continue

    // This might be a name line
    // Name lines contain letters, possibly with comma, period, or truncation (...)
    if (l.match(/[A-Za-z]/) && !isPageHeader(l)) {
      nameLines.unshift(l)
      // Stop after collecting enough name lines (max 4 for multi-word names)
      if (nameLines.length >= 4) break
    }
  }

  // Parse the collected name lines
  // Format variations:
  // ["Arache,", "Yery", "E"] - standard
  // ["Delacruz,", "Edy"] - no middle
  // ["Ayavaca", "Guaman,", "S..."] - multi-word last name
  // ["Espinal", "De", "Moran,..."] - 3-part last name, truncated first
  // ["Loor", "Bravo,", "Maryu..."] - 2-part last name, truncated first
  // ["Hernandez,", "Jonath..."] - truncated first name

  if (nameLines.length > 0) {
    // Find the line with the comma - everything up to and including that line is the last name
    let commaIdx = -1
    for (let n = 0; n < nameLines.length; n++) {
      if (nameLines[n].includes(',')) {
        commaIdx = n
        break
      }
    }

    if (commaIdx >= 0) {
      // Build last name from all lines up to and including comma line
      const lastNameParts: string[] = []
      for (let n = 0; n <= commaIdx; n++) {
        let part = nameLines[n].replace(/,.*$/, '').replace(/\.\.\.$/, '').trim()
        if (part) lastNameParts.push(part)
      }
      lastName = lastNameParts.join(' ')

      // After the comma line: first name, then possibly middle initial
      const afterComma = nameLines[commaIdx].split(',')[1]?.trim().replace(/\.\.\.$/, '').trim()

      if (afterComma && afterComma.length > 1) {
        firstName = afterComma
      } else if (commaIdx + 1 < nameLines.length) {
        firstName = nameLines[commaIdx + 1].replace(/\.\.\.$/, '').trim()
        if (commaIdx + 2 < nameLines.length) {
          const mi = nameLines[commaIdx + 2].trim()
          if (mi.length <= 2 && mi.match(/^[A-Z]$/)) {
            middleInitial = mi
          }
        }
      }

      // Check if first name line also has middle initial: "Yery E" or just "E"
      if (firstName && firstName.match(/^[A-Za-z]+\s+[A-Z]$/)) {
        const parts = firstName.split(/\s+/)
        firstName = parts[0]
        middleInitial = parts[parts.length - 1]
      }
    } else {
      // No comma found - use first line as last name
      lastName = nameLines[0].replace(/\.\.\.$/, '').trim()
      if (nameLines.length > 1) firstName = nameLines[1].replace(/\.\.\.$/, '').trim()
      if (nameLines.length > 2) {
        const mi = nameLines[2].trim()
        if (mi.length <= 2 && mi.match(/^[A-Z]$/)) middleInitial = mi
      }
    }
  }

  // Clean up
  lastName = lastName.trim()
  firstName = firstName.replace(/\.\.\.$/, '').trim()
  middleInitial = middleInitial.replace(/[^A-Z]/g, '').trim()

  return { lastName, firstName, middleInitial }
}

// ========== Helper: Parse a combined line like "94.24 Health" ==========
function parseCombinedLine(line: string): { value: number; label: string | null } {
  if (!line) return { value: 0, label: null }

  // Check for combined pattern: "<number> <label>"
  const match = line.match(/^([\d,.]+)\s+(.+)$/)
  if (match) {
    return { value: parseNumber(match[1]), label: match[2].trim() }
  }

  // Just a number
  return { value: parseNumber(line), label: null }
}

// ========== Helper: Apply a deduction label found on a combined line ==========
function applyDeductionLabel(pe: EmployeeData['payroll_entry'], label: string, lines: string[], nextLineIdx: number) {
  // The deduction amount is on the next line (or after EE/account for HSA)
  if (label === 'Health') {
    if (nextLineIdx < lines.length) pe.health_deduction += parseNumber(lines[nextLineIdx])
  } else if (label === 'Simple') {
    // "Simple" -> next line should be "Ira" -> then amount
    // But sometimes "Ira" + amount are handled separately
    // Don't parse here - let the main loop handle "Ira"
  } else if (label === 'HSA') {
    // HSA -> possibly "EE" -> possibly account -> amount
    let j = nextLineIdx
    if (j < lines.length && lines[j] === 'EE') j++
    if (j < lines.length && lines[j].match(/^\d{2,4}$/)) j++
    if (j < lines.length) pe.hsa += parseNumber(lines[j])
  } else if (label === 'Deduction') {
    if (nextLineIdx < lines.length) pe.other_deduction += parseNumber(lines[nextLineIdx])
  }
}

// ========== Helper: Collect next N numbers from lines (skipping blank lines) ==========
function collectNextNumbers(lines: string[], startIdx: number, maxCount: number): { numbers: number[]; count: number } {
  const numbers: number[] = []
  let j = startIdx
  let emptyCount = 0

  while (j < lines.length && numbers.length < maxCount && emptyCount < 3) {
    const line = lines[j]
    if (!line || line.match(/^\s*$/)) {
      emptyCount++
      j++
      continue
    }
    // Stop if we hit a non-number (field label, etc.)
    if (!line.match(/^[\d$,.]+$/)) break
    numbers.push(parseNumber(line))
    j++
  }

  return { numbers, count: numbers.length }
}
