import { PayrollEntry, Employee } from './supabase'

export interface ParsedPayroll {
  period_start: string
  period_end: string
  check_date: string
  run_date: string
  employees: (Employee & { payroll_entry: Omit<PayrollEntry, 'id' | 'payroll_period_id' | 'employee_id' | 'created_at'> })[]
  totals: {
    total_gross: number
    total_net: number
    total_withholdings: number
    total_deductions: number
    employee_count: number
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

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  return parseFloat(cleaned) || 0
}

function parseNumber(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, '').trim()
  return parseFloat(cleaned) || 0
}

export async function parsePaychexPDF(buffer: Buffer): Promise<ParsedPayroll> {
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buffer)
  const text = data.text

  const lines = text.split('\n').map(l => l.trim()).filter(l => l)

  let period_start = ''
  let period_end = ''
  let check_date = ''
  let run_date = ''

  // Extract header info: RunDate MM/DD/YY PeriodStart-EndDate MM/DD/YY- MM/DD/YY
  const footerMatch = text.match(/RunDate\s+(\d{1,2}\/\d{1,2}\/\d{2})\s+(\d{1,2}:\d{2}[AP]M)?\s*PeriodStart-EndDate\s+(\d{1,2}\/\d{1,2}\/\d{2})-\s*(\d{1,2}\/\d{1,2}\/\d{2})/)
  if (footerMatch) {
    run_date = parseDate(footerMatch[1])
    period_start = parseDate(footerMatch[3])
    period_end = parseDate(footerMatch[4])
    check_date = period_end
  }

  const employees: Map<string, any> = new Map()
  const employeeLines: { name: string; id: string; line: string }[] = []

  let currentDepartment = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Check for department header: **** 1DEPARTMENT1
    const deptMatch = line.match(/^\*{4}\s*(\d+)DEPARTMENT(\d+)/)
    if (deptMatch) {
      currentDepartment = parseInt(deptMatch[2])
      i++
      continue
    }

    // Check for employee name pattern (name with comma and first name)
    const nameMatch = line.match(/^([A-Z][a-z]+),([A-Z][a-z]+)/)
    if (nameMatch && !line.includes('TOTAL') && !line.includes('COMPANY')) {
      const fullName = nameMatch[1] + ', ' + nameMatch[2]
      const nextLine = i + 1 < lines.length ? lines[i + 1] : ''
      
      if (nextLine && /^\d+$/.test(nextLine)) {
        const empId = nextLine
        employeeLines.push({ name: fullName, id: empId, line: line })
        i += 2
        continue
      }
    }

    i++
  }

  // Process each employee
  for (const empLine of employeeLines) {
    const employeeKey = empLine.id
    if (!employees.has(employeeKey)) {
      employees.set(employeeKey, {
        employee_id: empLine.id,
        name: empLine.name,
        department: currentDepartment,
        hourly_rate: 0,
        is_active: true,
        first_seen: period_start,
        last_seen: period_end,
        payroll_entry: {
          department: currentDepartment,
          regular_hours: 0,
          overtime_hours: 0,
          double_time_hours: 0,
          vacation_hours: 0,
          total_hours: 0,
          regular_earnings: 0,
          overtime_earnings: 0,
          double_time_earnings: 0,
          vacation_earnings: 0,
          total_earnings: 0,
          hourly_rate: 0,
          social_security: 0,
          medicare: 0,
          fed_income_tax: 0,
          ct_income_tax: 0,
          ct_pfl: 0,
          total_withholdings: 0,
          health_deduction: 0,
          simple_ira: 0,
          other_deductions: 0,
          total_deductions: 0,
          net_pay: 0,
          check_number: '',
          direct_deposit_number: '',
        }
      })
    }
  }

  // Parse earnings and withholdings from text
  const lines2 = text.split('\n')
  let currentEmpKey = ''
  let checkNumber = ''
  let directDepositNumber = ''

  for (let j = 0; j < lines2.length; j++) {
    const line = lines2[j].trim()

    // Detect employee ID (numeric)
    if (/^\d+$/.test(line) && employees.has(line)) {
      currentEmpKey = line
      continue
    }

    if (!currentEmpKey || !employees.has(currentEmpKey)) continue

    const emp = employees.get(currentEmpKey)

    // Parse Regular, Overtime, Double Time, Vacation earnings
    if (line.startsWith('Regular ')) {
      const parts = line.split(/\s+/)
      if (parts.length >= 4) {
        const rate = parseNumber(parts[1])
        const hours = parseNumber(parts[2])
        const earnings = parseNumber(parts[3])
        emp.payroll_entry.regular_hours = hours
        emp.payroll_entry.regular_earnings = earnings
        if (emp.hourly_rate === 0) emp.hourly_rate = rate
        emp.payroll_entry.hourly_rate = rate
      }
    }

    if (line.startsWith('Overtime ')) {
      const parts = line.split(/\s+/)
      if (parts.length >= 4) {
        const rate = parseNumber(parts[1])
        const hours = parseNumber(parts[2])
        const earnings = parseNumber(parts[3])
        emp.payroll_entry.overtime_hours = hours
        emp.payroll_entry.overtime_earnings = earnings
      }
    }

    if (line.startsWith('Double Time ')) {
      const parts = line.split(/\s+/)
      if (parts.length >= 4) {
        const hours = parseNumber(parts[2])
        const earnings = parseNumber(parts[3])
        emp.payroll_entry.double_time_hours = hours
        emp.payroll_entry.double_time_earnings = earnings
      }
    }

    if (line.startsWith('Vacation ')) {
      const parts = line.split(/\s+/)
      if (parts.length >= 4) {
        const hours = parseNumber(parts[2])
        const earnings = parseNumber(parts[3])
        emp.payroll_entry.vacation_hours = hours
        emp.payroll_entry.vacation_earnings = earnings
      }
    }

    // Parse withholdings
    if (line.startsWith('Social Security ')) {
      const parts = line.split(/\s+/)
      emp.payroll_entry.social_security = parseNumber(parts[2])
    }

    if (line.startsWith('Medicare ')) {
      const parts = line.split(/\s+/)
      emp.payroll_entry.medicare = parseNumber(parts[1])
    }

    if (line.startsWith('Fed Income Tax ')) {
      const parts = line.split(/\s+/)
      emp.payroll_entry.fed_income_tax = parseNumber(parts[3])
    }

    if (line.startsWith('CT Income Tax ')) {
      const parts = line.split(/\s+/)
      emp.payroll_entry.ct_income_tax = parseNumber(parts[3])
    }

    if (line.startsWith('CT PFL ')) {
      const parts = line.split(/\s+/)
      emp.payroll_entry.ct_pfl = parseNumber(parts[2])
    }

    // Parse deductions
    if (line.startsWith('DirectDeposit#')) {
      directDepositNumber = line.replace('DirectDeposit#', '')
      emp.payroll_entry.direct_deposit_number = directDepositNumber
    }

    if (line.startsWith('CheckAmt ')) {
      const parts = line.split(/\s+/)
      emp.payroll_entry.check_number = ''
    }

    if (line.startsWith('Chkg')) {
      const match = line.match(/Chkg(\d+)\s+([\d,.]+)/)
      if (match) {
        checkNumber = match[1]
        emp.payroll_entry.check_number = checkNumber
        emp.payroll_entry.net_pay = parseNumber(match[2])
      }
    }

    if (line.startsWith('NetPay ')) {
      const parts = line.split(/\s+/)
      emp.payroll_entry.net_pay = parseNumber(parts[1])
    }

    if (line.startsWith('EMPLOYEE TOTAL ')) {
      const parts = line.split(/\s+/)
      if (parts.length >= 5) {
        emp.payroll_entry.total_hours = parseNumber(parts[2])
        emp.payroll_entry.total_earnings = parseNumber(parts[3])
        emp.payroll_entry.total_withholdings = parseNumber(parts[4])
      }
    }
  }

  // Calculate totals and finalize
  let total_gross = 0
  let total_net = 0
  let total_withholdings = 0
  let total_deductions = 0

  employees.forEach(emp => {
    const pe = emp.payroll_entry
    pe.total_hours = (pe.regular_hours || 0) + (pe.overtime_hours || 0) + (pe.double_time_hours || 0) + (pe.vacation_hours || 0)
    pe.total_earnings = (pe.regular_earnings || 0) + (pe.overtime_earnings || 0) + (pe.double_time_earnings || 0) + (pe.vacation_earnings || 0)
    pe.total_withholdings = (pe.social_security || 0) + (pe.medicare || 0) + (pe.fed_income_tax || 0) + (pe.ct_income_tax || 0) + (pe.ct_pfl || 0)
    pe.total_deductions = (pe.health_deduction || 0) + (pe.simple_ira || 0) + (pe.other_deductions || 0)
    
    if (pe.net_pay === 0) {
      pe.net_pay = pe.total_earnings - pe.total_withholdings - pe.total_deductions
    }

    total_gross += pe.total_earnings
    total_net += pe.net_pay
    total_withholdings += pe.total_withholdings
    total_deductions += pe.total_deductions
  })

  return {
    period_start,
    period_end,
    check_date,
    run_date,
    employees: Array.from(employees.values()),
    totals: {
      total_gross,
      total_net,
      total_withholdings,
      total_deductions,
      employee_count: employees.size
    }
  }
}
