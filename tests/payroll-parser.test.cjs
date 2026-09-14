require('./load-ts.cjs')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parsePaychexText, extractCompanyBreakdownFromText } = require('../lib/pdf-parser.ts')
const { getPayrollReconciliationIssues } = require('../lib/payroll-reconciliation.ts')

const header = 'Date 09/14/26\n08/29/26\n- 09/11/26\nCheck\nDate\n09/16/26\nPYRJRN\n'
const identity = 'Sample,\nWorker\n'
const marker = 'Direct\nDeposit\n# Unknown\n101\n'
const employeeTotal = (hours, earnings, withheld = '0.00', deducted = '0.00', net = earnings) =>
  `EMPLOYEE\nTOTAL\n${hours}\n${earnings}\n${withheld}\n${deducted}\nNet\nPay\n${net}\n`
const summary = (labels, hours, earnings, totals = '88.0000\n1,920.00', deductions = '0.000.000.000.00', net = '1,920.00') =>
  `COMPANY\nTOTALS\n1\nPerson(s)\n2\nTransaction(s)\n${labels}\n${hours}\n${earnings}\nSocial SecurityMedicareFed Income TaxCT Income TaxCT PFML\n0.000.000.000.000.00\nDeductionHSA\nEE\nIndividual\nHealthSimple\nIra\n${deductions}\nCheck\nAmt\n120.00\nDir\nDep**\n1,800.00\nCOMPANY TOTAL\n${totals}\n0.00\n0.00\nNet\nPay\n${net}\n`

for (const label of ['Double Time', 'Double\nTime']) {
  for (const beforeId of [true, false]) {
    test(`reads ${JSON.stringify(label)} ${beforeId ? 'before' : 'after'} employee ID`, () => {
      const row = `${label}\n40.0000\n8.0000\n320.00\n`
      const parsed = parsePaychexText(header + identity + (beforeId ? row + marker : marker + row) + employeeTotal('8.0000', '320.00'))
      assert.equal(parsed.employees[0].payroll_entry.double_time_hours, 8)
      assert.equal(parsed.employees[0].payroll_entry.double_time_earnings, 320)
    })
  }
}

test('adds regular rows across checks and includes paper checks in company net pay', () => {
  const text = header + identity + 'Regular\n20.0000\n40.0000\n800.00\n' + marker +
    'CHECK\n1 TOTAL\n40.0000\n800.00\n0.00\nNet\nPay\n800.00\n' +
    'Regular\n20.0000\n40.0000\n800.00\nDouble Time\n40.0000\n8.0000\n320.00\n' +
    employeeTotal('88.0000', '1,920.00') + summary('RegularDouble\nTime', '80.00008.0000', '1,600.00320.00')
  const parsed = parsePaychexText(text)
  const entry = parsed.employees[0].payroll_entry
  assert.equal(entry.regular_hours, 80)
  assert.equal(entry.regular_earnings, 1600)
  assert.equal(parsed.totals.total_net_pay, 1920)
  assert.deepEqual(getPayrollReconciliationIssues(parsed), [])
  entry.double_time_hours = 0
  assert.ok(getPayrollReconciliationIssues(parsed).some(issue => issue.includes('hours')))
})

test('summary without Double Time preserves overtime and vacation columns', () => {
  const result = extractCompanyBreakdownFromText(summary('RegularOvertimeVacation', '80.000010.0000\n8.0000', '1,600.00300.00\n160.00'))
  assert.equal(result.regular_hours, 80)
  assert.equal(result.overtime_hours, 10)
  assert.equal(result.vacation_hours, 8)
  assert.equal(result.double_time_hours, 0)
  assert.equal(result.overtime_earnings, 300)
})

test('summary without vacation does not shift other categories', () => {
  const result = extractCompanyBreakdownFromText(summary('RegularDouble\nTimeOvertime', '80.00008.000010.0000', '1,600.00320.00300.00'))
  assert.equal(result.double_time_hours, 8)
  assert.equal(result.overtime_hours, 10)
  assert.equal(result.vacation_hours, 0)
})

test('summary without a loan maps Simple IRA to Simple IRA', () => {
  const result = extractCompanyBreakdownFromText(summary('Regular', '80.0000', '1,600.00', undefined, '250.00100.00651.88929.96'))
  assert.equal(result.simple_ira, 929.96)
  assert.equal(result.loan_repayment, 0)
})

test('reads a deduction joined to an income tax row and sums checking and savings deposits', () => {
  const parsed = parsePaychexText(header + identity + 'Regular\n20.0000\n80.0000\n1,600.00\n' + marker +
    'Fed Income Tax\n100.00 Simple\nIra\n80.00\nChkg\n123\n1,200.00\nSavg\n456\n220.00\n' +
    employeeTotal('80.0000', '1,600.00', '100.00', '80.00', '1,420.00'))
  const entry = parsed.employees[0].payroll_entry
  assert.equal(entry.fed_income_tax, 100)
  assert.equal(entry.simple_ira, 80)
  assert.equal(entry.direct_deposit_amount, 1420)
})

test('an empty or unsupported import fails reconciliation', () => {
  assert.ok(getPayrollReconciliationIssues(parsePaychexText('unrecognized journal')).length > 0)
})
