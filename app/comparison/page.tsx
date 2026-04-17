'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'

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

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
  const fmtNum = (n: number) => (n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })

  const calcChange = (cur: number, prev: number) => {
    const diff = (cur || 0) - (prev || 0)
    const pct = prev ? (diff / prev) * 100 : 0
    return { diff, pct }
  }

  const ChangeCell = ({ cur, prev, isCurrency }: { cur: number; prev: number; isCurrency: boolean }) => {
    const { diff, pct } = calcChange(cur, prev)
    const isPos = diff >= 0
    const color = diff === 0 ? 'text-gray-400' : isPos ? 'text-emerald-600' : 'text-red-600'
    return (
      <>
        <td className={`py-2.5 px-3 text-right text-sm font-medium ${color}`}>
          {isPos && diff !== 0 ? '+' : ''}{isCurrency ? fmt(diff) : fmtNum(diff)}
        </td>
        <td className={`py-2.5 px-3 text-right text-sm font-medium ${color}`}>
          {prev ? `${isPos && diff !== 0 ? '+' : ''}${pct.toFixed(1)}%` : '—'}
        </td>
      </>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div className="card text-center py-16">
        <p className="text-gray-500 font-medium">No payroll periods uploaded yet.</p>
        <p className="text-sm text-gray-400 mt-1">
          <Link href="/upload" className="text-blue-600 hover:underline">Upload PDFs</Link> first.
        </p>
      </div>
    )
  }

  const selectClass = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"

  const tableHeader = (cols: string[]) => (
    <thead>
      <tr className="border-b-2 border-gray-100">
        {cols.map((c, i) => (
          <th key={i} className={`py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-right'}`}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )

  return (
    <>
      {/* Period selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Period</label>
          <select value={currentId} onChange={(e) => setCurrentId(e.target.value)} className={selectClass}>
            <option value="">Select period...</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.period_start} to {p.period_end} ({p.total_persons} employees)</option>
            ))}
          </select>
        </div>
        <div className="card p-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Compare To</label>
          <select value={previousId} onChange={(e) => setPreviousId(e.target.value)} className={selectClass}>
            <option value="">Select period...</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.period_start} to {p.period_end} ({p.total_persons} employees)</option>
            ))}
          </select>
        </div>
      </div>

      {comparing && (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
        </div>
      )}

      {currentId && previousId && currentId === previousId && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm mb-6">
          Please select two different periods to compare.
        </div>
      )}

      {current && previous && !comparing && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="card border-l-4 border-blue-500 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Current Period</p>
              <p className="text-gray-500 text-sm mb-2">{current.period_start} — {current.period_end}</p>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600">{fmt(current.total_earnings)}</p>
              <p className="text-sm text-gray-500 mt-1">{current.total_persons} employees · {fmtNum(current.total_hours)} hours</p>
            </div>
            <div className="card border-l-4 border-gray-300 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Compare Period</p>
              <p className="text-gray-500 text-sm mb-2">{previous.period_start} — {previous.period_end}</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-700">{fmt(previous.total_earnings)}</p>
              <p className="text-sm text-gray-500 mt-1">{previous.total_persons} employees · {fmtNum(previous.total_hours)} hours</p>
            </div>
          </div>

          {/* Employee Differences */}
          {employeeDiff && (employeeDiff.newEmployees.length > 0 || employeeDiff.missingEmployees.length > 0) && (
            <div className="card mb-6 p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-900">Employee Differences</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Current: {employeeDiff.currentCount} · Previous: {employeeDiff.previousCount}
                </p>
              </div>
              <div className="p-4 sm:p-6 space-y-6">
                {employeeDiff.newEmployees.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      New in Current Period ({employeeDiff.newEmployees.length})
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        {tableHeader(['Employee', 'Dept', 'Hours', 'Earnings', 'Net Pay'])}
                        <tbody>
                          {employeeDiff.newEmployees.map((emp) => (
                            <tr key={emp.employee_id} className="border-b border-gray-50 bg-emerald-50/50">
                              <td className="py-2.5 px-3 font-medium text-gray-900">{emp.name}</td>
                              <td className="py-2.5 px-3 text-right text-gray-600">{emp.department}</td>
                              <td className="py-2.5 px-3 text-right">{fmtNum(emp.total_hours)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-700 font-medium">+{fmt(emp.total_earnings)}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-700">{fmt(emp.net_pay)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {employeeDiff.missingEmployees.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                      Not in Current Period ({employeeDiff.missingEmployees.length})
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        {tableHeader(['Employee', 'Dept', 'Hours (prev)', 'Earnings (prev)', 'Net Pay (prev)'])}
                        <tbody>
                          {employeeDiff.missingEmployees.map((emp) => (
                            <tr key={emp.employee_id} className="border-b border-gray-50 bg-red-50/50">
                              <td className="py-2.5 px-3 font-medium text-gray-900">{emp.name}</td>
                              <td className="py-2.5 px-3 text-right text-gray-600">{emp.department}</td>
                              <td className="py-2.5 px-3 text-right">{fmtNum(emp.total_hours)}</td>
                              <td className="py-2.5 px-3 text-right text-red-700 font-medium">-{fmt(emp.total_earnings)}</td>
                              <td className="py-2.5 px-3 text-right text-red-700">{fmt(emp.net_pay)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hours & Earnings */}
          <div className="card mb-6 p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Hours & Earnings Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {tableHeader(['Category', 'Curr Hours', 'Prev Hours', 'Curr Earnings', 'Prev Earnings', 'Diff', '%'])}
                <tbody>
                  {[
                    { label: 'Regular', curH: current.breakdown.regular_hours, prevH: previous.breakdown.regular_hours, curE: current.breakdown.regular_earnings, prevE: previous.breakdown.regular_earnings },
                    { label: 'Overtime', curH: current.breakdown.overtime_hours, prevH: previous.breakdown.overtime_hours, curE: current.breakdown.overtime_earnings, prevE: previous.breakdown.overtime_earnings },
                    { label: 'Double Time', curH: current.breakdown.double_time_hours, prevH: previous.breakdown.double_time_hours, curE: current.breakdown.double_time_earnings, prevE: previous.breakdown.double_time_earnings },
                    { label: 'Vacation', curH: current.breakdown.vacation_hours, prevH: previous.breakdown.vacation_hours, curE: current.breakdown.vacation_earnings, prevE: previous.breakdown.vacation_earnings },
                  ].map((row) => {
                    const d = calcChange(row.curE, row.prevE)
                    const c = d.diff === 0 ? 'text-gray-400' : d.diff > 0 ? 'text-emerald-600' : 'text-red-600'
                    return (
                      <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50/80">
                        <td className="py-2.5 px-3 font-medium text-gray-800">{row.label}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{fmtNum(row.curH)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-400">{fmtNum(row.prevH)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{fmt(row.curE)}</td>
                        <td className="py-2.5 px-3 text-right text-gray-400">{fmt(row.prevE)}</td>
                        <td className={`py-2.5 px-3 text-right font-medium ${c}`}>{d.diff >= 0 && d.diff !== 0 ? '+' : ''}{fmt(d.diff)}</td>
                        <td className={`py-2.5 px-3 text-right font-medium ${c}`}>{row.prevE ? `${d.pct >= 0 && d.diff !== 0 ? '+' : ''}${d.pct.toFixed(1)}%` : '—'}</td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="py-2.5 px-3 text-gray-900">Total</td>
                    <td className="py-2.5 px-3 text-right">{fmtNum(current.breakdown.total_hours)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{fmtNum(previous.breakdown.total_hours)}</td>
                    <td className="py-2.5 px-3 text-right">{fmt(current.breakdown.total_earnings)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{fmt(previous.breakdown.total_earnings)}</td>
                    {(() => {
                      const d = calcChange(current.breakdown.total_earnings, previous.breakdown.total_earnings)
                      const c = d.diff === 0 ? 'text-gray-400' : d.diff > 0 ? 'text-emerald-600' : 'text-red-600'
                      return (<><td className={`py-2.5 px-3 text-right ${c}`}>{d.diff >= 0 ? '+' : ''}{fmt(d.diff)}</td><td className={`py-2.5 px-3 text-right ${c}`}>{d.pct >= 0 ? '+' : ''}{d.pct.toFixed(1)}%</td></>)
                    })()}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Withholdings */}
          <div className="card mb-6 p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Withholdings Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {tableHeader(['Withholding', 'Current', 'Previous', 'Difference', '%'])}
                <tbody>
                  {[
                    { label: 'Social Security', cur: current.breakdown.social_security, prev: previous.breakdown.social_security },
                    { label: 'Medicare', cur: current.breakdown.medicare, prev: previous.breakdown.medicare },
                    { label: 'Fed Income Tax', cur: current.breakdown.fed_income_tax, prev: previous.breakdown.fed_income_tax },
                    { label: 'CT Income Tax', cur: current.breakdown.ct_income_tax, prev: previous.breakdown.ct_income_tax },
                    { label: 'CT PFL', cur: current.breakdown.ct_pfl, prev: previous.breakdown.ct_pfl },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{row.label}</td>
                      <td className="py-2.5 px-3 text-right text-gray-700">{fmt(row.cur)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-400">{fmt(row.prev)}</td>
                      <ChangeCell cur={row.cur} prev={row.prev} isCurrency={true} />
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="py-2.5 px-3 text-gray-900">Total Withholdings</td>
                    <td className="py-2.5 px-3 text-right">{fmt(current.breakdown.total_withholdings)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{fmt(previous.breakdown.total_withholdings)}</td>
                    <ChangeCell cur={current.breakdown.total_withholdings} prev={previous.breakdown.total_withholdings} isCurrency={true} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Deductions */}
          <div className="card mb-6 p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Deductions Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {tableHeader(['Deduction', 'Current', 'Previous', 'Difference', '%'])}
                <tbody>
                  {[
                    { label: 'Health', cur: current.breakdown.health_deduction, prev: previous.breakdown.health_deduction },
                    { label: 'Simple IRA', cur: current.breakdown.simple_ira, prev: previous.breakdown.simple_ira },
                    { label: 'HSA', cur: current.breakdown.hsa, prev: previous.breakdown.hsa },
                    { label: 'Loan Repayment', cur: current.breakdown.loan_repayment, prev: previous.breakdown.loan_repayment },
                    { label: 'Other', cur: current.breakdown.other_deduction, prev: previous.breakdown.other_deduction },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="py-2.5 px-3 font-medium text-gray-800">{row.label}</td>
                      <td className="py-2.5 px-3 text-right text-gray-700">{fmt(row.cur)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-400">{fmt(row.prev)}</td>
                      <ChangeCell cur={row.cur} prev={row.prev} isCurrency={true} />
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="py-2.5 px-3 text-gray-900">Total Deductions</td>
                    <td className="py-2.5 px-3 text-right">{fmt(current.breakdown.total_deductions)}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{fmt(previous.breakdown.total_deductions)}</td>
                    <ChangeCell cur={current.breakdown.total_deductions} prev={previous.breakdown.total_deductions} isCurrency={true} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Totals */}
          <div className="card mb-6 p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Summary Totals</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                {tableHeader(['Metric', 'Current', 'Previous', 'Difference', '%'])}
                <tbody>
                  {[
                    { label: 'Total Earnings', cur: current.total_earnings, prev: previous.total_earnings, highlight: false },
                    { label: 'Total Withholdings', cur: current.total_withholdings, prev: previous.total_withholdings, highlight: false },
                    { label: 'Total Deductions', cur: current.total_deductions, prev: previous.total_deductions, highlight: false },
                    { label: 'Net Pay', cur: current.total_net_pay, prev: previous.total_net_pay, highlight: true },
                    { label: 'Employer Liability', cur: current.total_employer_liability, prev: previous.total_employer_liability, highlight: false },
                    { label: 'Total Tax Liability', cur: current.total_tax_liability, prev: previous.total_tax_liability, highlight: false },
                  ].map((row) => (
                    <tr key={row.label} className={`border-b border-gray-50 hover:bg-gray-50/80 ${row.highlight ? 'bg-blue-50/60 font-bold' : ''}`}>
                      <td className="py-2.5 px-3 font-medium text-gray-800">{row.label}</td>
                      <td className="py-2.5 px-3 text-right text-gray-700">{fmt(row.cur)}</td>
                      <td className="py-2.5 px-3 text-right text-gray-400">{fmt(row.prev)}</td>
                      <ChangeCell cur={row.cur} prev={row.prev} isCurrency={true} />
                    </tr>
                  ))}
                  <tr className="border-b border-gray-50 hover:bg-gray-50/80">
                    <td className="py-2.5 px-3 font-medium text-gray-800">Employees</td>
                    <td className="py-2.5 px-3 text-right text-gray-700">{current.total_persons}</td>
                    <td className="py-2.5 px-3 text-right text-gray-400">{previous.total_persons}</td>
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-8 pt-16 lg:pt-8">

          <div className="page-header">
            <h1>Payroll Comparison</h1>
            <p>Compare two payroll periods side by side</p>
          </div>

          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
            </div>
          }>
            <ComparisonContent />
          </Suspense>

        </div>
      </div>
    </div>
  )
}
