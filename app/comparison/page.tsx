'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

type PayrollPeriod = {
  id: string
  period_start: string
  period_end: string
  check_date: string
  total_earnings: number
  total_net_pay: number
  total_withholdings: number
  total_deductions: number
  total_persons: number
  total_hours: number
  total_employer_liability: number
  total_tax_liability: number
  breakdown: {
    regular_hours: number
    regular_earnings: number
    overtime_hours: number
    overtime_earnings: number
    double_time_hours: number
    double_time_earnings: number
    vacation_hours: number
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
  }
}

type PeriodOption = {
  id: string
  period_start: string
  period_end: string
  total_persons: number
}

type EmployeeDiffEntry = {
  employee_id: string
  name: string
  department: number
  total_hours: number
  total_earnings: number
  net_pay: number
}

type EmployeeDiff = {
  currentCount: number
  previousCount: number
  newEmployees: EmployeeDiffEntry[]
  missingEmployees: EmployeeDiffEntry[]
}

function ComparisonContent() {
  const router = useRouter()
  const [periods, setPeriods] = useState<PeriodOption[]>([])
  const [currentId, setCurrentId] = useState<string>('')
  const [previousId, setPreviousId] = useState<string>('')
  const [current, setCurrent] = useState<PayrollPeriod | null>(null)
  const [previous, setPrevious] = useState<PayrollPeriod | null>(null)
  const [employeeDiff, setEmployeeDiff] = useState<EmployeeDiff | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) router.push('/')
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const res = await fetch('/api/payroll-periods')
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setPeriods(data)
          setCurrentId(data[0].id)
          if (data.length > 1) setPreviousId(data[1].id)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPeriods()
  }, [])

  useEffect(() => {
    if (!currentId || !previousId || currentId === previousId) return

    const doCompare = async () => {
      setComparing(true)
      try {
        const res = await fetch(`/api/comparison?currentId=${currentId}&previousId=${previousId}`)
        const data = await res.json()
        setCurrent(data.current)
        setPrevious(data.previous)
        setEmployeeDiff(data.employeeDiff || null)
      } catch (err) {
        console.error(err)
      } finally {
        setComparing(false)
      }
    }
    doCompare()
  }, [currentId, previousId])

  const fmt = (n: number) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtNum = (n: number) => (n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

  const calcChange = (cur: number, prev: number) => {
    const diff = (cur || 0) - (prev || 0)
    const pct = prev ? (diff / prev) * 100 : 0
    return { diff, pct }
  }

  const ChangeCell = ({ cur, prev, isCurrency }: { cur: number; prev: number; isCurrency: boolean }) => {
    const { diff, pct } = calcChange(cur, prev)
    const isPos = diff >= 0
    const color = diff === 0 ? 'text-gray-500' : isPos ? 'text-green-600' : 'text-red-600'
    return (
      <>
        <td className={`py-2 px-3 text-right font-medium ${color}`}>
          {isPos && diff !== 0 ? '+' : ''}{isCurrency ? fmt(diff) : fmtNum(diff)}
        </td>
        <td className={`py-2 px-3 text-right font-medium ${color}`}>
          {prev ? `${isPos && diff !== 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
        </td>
      </>
    )
  }

  if (loading) return <div className="text-center py-12">Loading...</div>

  if (periods.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No payroll periods uploaded yet. <Link href="/upload" className="text-blue-500 underline">Upload PDFs</Link> first.
      </div>
    )
  }

  return (
    <>
      {/* Period selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Current Period</label>
          <select
            value={currentId}
            onChange={(e) => setCurrentId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select period...</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {p.period_start} to {p.period_end} ({p.total_persons} employees)
              </option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Compare To</label>
          <select
            value={previousId}
            onChange={(e) => setPreviousId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select period...</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>
                {p.period_start} to {p.period_end} ({p.total_persons} employees)
              </option>
            ))}
          </select>
        </div>
      </div>

      {comparing && <div className="text-center py-8 text-gray-500">Comparing periods...</div>}

      {currentId && previousId && currentId === previousId && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm mb-6">
          Please select two different periods to compare.
        </div>
      )}

      {current && previous && !comparing && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-blue-500">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Current Period</h3>
              <p className="text-gray-600 text-xs sm:text-sm mb-2">{current.period_start} to {current.period_end}</p>
              <p className="text-xl sm:text-3xl font-bold text-blue-600">{fmt(current.total_earnings)}</p>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">{current.total_persons} employees | {fmtNum(current.total_hours)} hours</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 border-l-4 border-gray-400">
              <h3 className="text-xs sm:text-sm font-semibold text-gray-500 mb-1">Compare Period</h3>
              <p className="text-gray-600 text-xs sm:text-sm mb-2">{previous.period_start} to {previous.period_end}</p>
              <p className="text-xl sm:text-3xl font-bold text-gray-700">{fmt(previous.total_earnings)}</p>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">{previous.total_persons} employees | {fmtNum(previous.total_hours)} hours</p>
            </div>
          </div>

          {/* Employee Differences */}
          {employeeDiff && (employeeDiff.newEmployees.length > 0 || employeeDiff.missingEmployees.length > 0) && (
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-6 mb-4 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Employee Differences</h2>
              <p className="text-sm text-gray-600 mb-4">
                Current: {employeeDiff.currentCount} employees | Previous: {employeeDiff.previousCount} employees
              </p>

              {employeeDiff.newEmployees.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                    New in Current Period ({employeeDiff.newEmployees.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Employee</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Dept</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Hours</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Earnings</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeDiff.newEmployees.map((emp) => (
                          <tr key={emp.employee_id} className="border-b border-gray-100 bg-green-50">
                            <td className="py-2 px-3 text-gray-900">{emp.name}</td>
                            <td className="py-2 px-3 text-gray-600">{emp.department}</td>
                            <td className="py-2 px-3 text-right">{fmtNum(emp.total_hours)}</td>
                            <td className="py-2 px-3 text-right text-green-700 font-medium">+{fmt(emp.total_earnings)}</td>
                            <td className="py-2 px-3 text-right text-green-700">{fmt(emp.net_pay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {employeeDiff.missingEmployees.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500"></span>
                    Not in Current Period ({employeeDiff.missingEmployees.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Employee</th>
                          <th className="text-left py-2 px-3 font-semibold text-gray-700">Dept</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Hours (prev)</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Earnings (prev)</th>
                          <th className="text-right py-2 px-3 font-semibold text-gray-700">Net Pay (prev)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeDiff.missingEmployees.map((emp) => (
                          <tr key={emp.employee_id} className="border-b border-gray-100 bg-red-50">
                            <td className="py-2 px-3 text-gray-900">{emp.name}</td>
                            <td className="py-2 px-3 text-gray-600">{emp.department}</td>
                            <td className="py-2 px-3 text-right">{fmtNum(emp.total_hours)}</td>
                            <td className="py-2 px-3 text-right text-red-700 font-medium">-{fmt(emp.total_earnings)}</td>
                            <td className="py-2 px-3 text-right text-red-700">{fmt(emp.net_pay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hours & Earnings Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-6 mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Hours & Earnings Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Category</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-600">Current Hours</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500">Prev Hours</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-600">Current Earnings</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500">Prev Earnings</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Diff</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Regular', curH: current.breakdown.regular_hours, prevH: previous.breakdown.regular_hours, curE: current.breakdown.regular_earnings, prevE: previous.breakdown.regular_earnings },
                    { label: 'Overtime', curH: current.breakdown.overtime_hours, prevH: previous.breakdown.overtime_hours, curE: current.breakdown.overtime_earnings, prevE: previous.breakdown.overtime_earnings },
                    { label: 'Double Time', curH: current.breakdown.double_time_hours, prevH: previous.breakdown.double_time_hours, curE: current.breakdown.double_time_earnings, prevE: previous.breakdown.double_time_earnings },
                    { label: 'Vacation', curH: current.breakdown.vacation_hours, prevH: previous.breakdown.vacation_hours, curE: current.breakdown.vacation_earnings, prevE: previous.breakdown.vacation_earnings },
                  ].map((row) => {
                    const earningsDiff = calcChange(row.curE, row.prevE)
                    const diffColor = earningsDiff.diff === 0 ? 'text-gray-500' : earningsDiff.diff > 0 ? 'text-green-600' : 'text-red-600'
                    return (
                      <tr key={row.label} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-900">{row.label}</td>
                        <td className="py-2 px-3 text-right">{fmtNum(row.curH)}</td>
                        <td className="py-2 px-3 text-right text-gray-500">{fmtNum(row.prevH)}</td>
                        <td className="py-2 px-3 text-right">{fmt(row.curE)}</td>
                        <td className="py-2 px-3 text-right text-gray-500">{fmt(row.prevE)}</td>
                        <td className={`py-2 px-3 text-right font-medium ${diffColor}`}>
                          {earningsDiff.diff >= 0 && earningsDiff.diff !== 0 ? '+' : ''}{fmt(earningsDiff.diff)}
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${diffColor}`}>
                          {row.prevE ? `${earningsDiff.pct >= 0 && earningsDiff.diff !== 0 ? '+' : ''}${earningsDiff.pct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="py-2 px-3 text-gray-900">TOTAL</td>
                    <td className="py-2 px-3 text-right">{fmtNum(current.breakdown.total_hours)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{fmtNum(previous.breakdown.total_hours)}</td>
                    <td className="py-2 px-3 text-right">{fmt(current.breakdown.total_earnings)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{fmt(previous.breakdown.total_earnings)}</td>
                    {(() => {
                      const d = calcChange(current.breakdown.total_earnings, previous.breakdown.total_earnings)
                      const c = d.diff === 0 ? 'text-gray-500' : d.diff > 0 ? 'text-green-600' : 'text-red-600'
                      return (
                        <>
                          <td className={`py-2 px-3 text-right ${c}`}>{d.diff >= 0 ? '+' : ''}{fmt(d.diff)}</td>
                          <td className={`py-2 px-3 text-right ${c}`}>{d.pct >= 0 ? '+' : ''}{d.pct.toFixed(1)}%</td>
                        </>
                      )
                    })()}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Withholdings Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-6 mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Withholdings Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Withholding</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-600">Current</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500">Previous</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Difference</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Social Security', cur: current.breakdown.social_security, prev: previous.breakdown.social_security },
                    { label: 'Medicare', cur: current.breakdown.medicare, prev: previous.breakdown.medicare },
                    { label: 'Fed Income Tax', cur: current.breakdown.fed_income_tax, prev: previous.breakdown.fed_income_tax },
                    { label: 'CT Income Tax', cur: current.breakdown.ct_income_tax, prev: previous.breakdown.ct_income_tax },
                    { label: 'CT PFL', cur: current.breakdown.ct_pfl, prev: previous.breakdown.ct_pfl },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">{row.label}</td>
                      <td className="py-2 px-3 text-right">{fmt(row.cur)}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{fmt(row.prev)}</td>
                      <ChangeCell cur={row.cur} prev={row.prev} isCurrency={true} />
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="py-2 px-3 text-gray-900">TOTAL WITHHOLDINGS</td>
                    <td className="py-2 px-3 text-right">{fmt(current.breakdown.total_withholdings)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{fmt(previous.breakdown.total_withholdings)}</td>
                    <ChangeCell cur={current.breakdown.total_withholdings} prev={previous.breakdown.total_withholdings} isCurrency={true} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Deductions Breakdown */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-6 mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Deductions Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Deduction</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-600">Current</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500">Previous</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Difference</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Health', cur: current.breakdown.health_deduction, prev: previous.breakdown.health_deduction },
                    { label: 'Simple IRA', cur: current.breakdown.simple_ira, prev: previous.breakdown.simple_ira },
                    { label: 'HSA', cur: current.breakdown.hsa, prev: previous.breakdown.hsa },
                    { label: 'Loan Repayment', cur: current.breakdown.loan_repayment, prev: previous.breakdown.loan_repayment },
                    { label: 'Other', cur: current.breakdown.other_deduction, prev: previous.breakdown.other_deduction },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 font-medium text-gray-900">{row.label}</td>
                      <td className="py-2 px-3 text-right">{fmt(row.cur)}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{fmt(row.prev)}</td>
                      <ChangeCell cur={row.cur} prev={row.prev} isCurrency={true} />
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="py-2 px-3 text-gray-900">TOTAL DEDUCTIONS</td>
                    <td className="py-2 px-3 text-right">{fmt(current.breakdown.total_deductions)}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{fmt(previous.breakdown.total_deductions)}</td>
                    <ChangeCell cur={current.breakdown.total_deductions} prev={previous.breakdown.total_deductions} isCurrency={true} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Pay & Totals Summary */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-6 mb-4 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">Summary Totals</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Metric</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-600">Current</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500">Previous</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Difference</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-700">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Total Earnings', cur: current.total_earnings, prev: previous.total_earnings, isCurrency: true },
                    { label: 'Total Withholdings', cur: current.total_withholdings, prev: previous.total_withholdings, isCurrency: true },
                    { label: 'Total Deductions', cur: current.total_deductions, prev: previous.total_deductions, isCurrency: true },
                    { label: 'Net Pay', cur: current.total_net_pay, prev: previous.total_net_pay, isCurrency: true },
                    { label: 'Employer Liability', cur: current.total_employer_liability, prev: previous.total_employer_liability, isCurrency: true },
                    { label: 'Total Tax Liability', cur: current.total_tax_liability, prev: previous.total_tax_liability, isCurrency: true },
                  ].map((row) => (
                    <tr key={row.label} className={`border-b border-gray-100 hover:bg-gray-50 ${row.label === 'Net Pay' ? 'bg-blue-50 font-bold' : ''}`}>
                      <td className="py-2 px-3 font-medium text-gray-900">{row.label}</td>
                      <td className="py-2 px-3 text-right">{fmt(row.cur)}</td>
                      <td className="py-2 px-3 text-right text-gray-500">{fmt(row.prev)}</td>
                      <ChangeCell cur={row.cur} prev={row.prev} isCurrency={true} />
                    </tr>
                  ))}
                  <tr className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">Employees</td>
                    <td className="py-2 px-3 text-right">{current.total_persons}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{previous.total_persons}</td>
                    <ChangeCell cur={current.total_persons} prev={previous.total_persons} isCurrency={false} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default function ComparisonPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container px-4 sm:px-6 flex items-center justify-between py-3 sm:py-4">
          <Link href="/dashboard" className="text-lg sm:text-2xl font-bold">Payroll Dashboard</Link>
          <Link href="/dashboard" className="text-sm sm:text-base text-blue-500 hover:underline">Back to Dashboard</Link>
        </div>
      </nav>

      <div className="container px-4 sm:px-6 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Payroll Comparison</h1>
        <Suspense fallback={<div>Loading...</div>}>
          <ComparisonContent />
        </Suspense>
      </div>
    </div>
  )
}
