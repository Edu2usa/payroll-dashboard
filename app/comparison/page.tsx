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
}

function ComparisonContent() {
  const router = useRouter()
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [currentId, setCurrentId] = useState<string>('')
  const [previousId, setPreviousId] = useState<string>('')
  const [current, setCurrent] = useState<PayrollPeriod | null>(null)
  const [previous, setPrevious] = useState<PayrollPeriod | null>(null)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) router.push('/')
    }
    checkAuth()
  }, [router])

  // Load all periods for the dropdowns
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const res = await fetch('/api/payroll-periods')
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setPeriods(data)
          // Auto-select latest two periods
          setCurrentId(data[0].id)
          if (data.length > 1) {
            setPreviousId(data[1].id)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPeriods()
  }, [])

  // Auto-compare when both periods are selected
  useEffect(() => {
    if (!currentId || !previousId || currentId === previousId) return

    const doCompare = async () => {
      setComparing(true)
      try {
        const [curRes, prevRes] = await Promise.all([
          fetch(`/api/payroll-periods/${currentId}`),
          fetch(`/api/payroll-periods/${previousId}`),
        ])
        const curData = await curRes.json()
        const prevData = await prevRes.json()
        setCurrent(curData)
        setPrevious(prevData)
      } catch (err) {
        console.error(err)
      } finally {
        setComparing(false)
      }
    }
    doCompare()
  }, [currentId, previousId])

  const formatCurrency = (n: number) => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const formatNumber = (n: number) => (n || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })

  const calcChange = (cur: number, prev: number) => {
    if (!prev) return { pct: 0, diff: cur }
    return { pct: ((cur - prev) / prev) * 100, diff: cur - prev }
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
          <label className="block text-sm font-semibold text-gray-700 mb-2">Previous Period</label>
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

      {comparing && <div className="text-center py-8">Comparing...</div>}

      {current && previous && !comparing && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
              <h3 className="text-sm font-semibold text-gray-500 mb-1">Current Period</h3>
              <p className="text-gray-600 text-sm mb-2">{current.period_start} to {current.period_end}</p>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(current.total_earnings)}</p>
              <p className="text-sm text-gray-600 mt-1">{current.total_persons} employees</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-400">
              <h3 className="text-sm font-semibold text-gray-500 mb-1">Previous Period</h3>
              <p className="text-gray-600 text-sm mb-2">{previous.period_start} to {previous.period_end}</p>
              <p className="text-3xl font-bold text-gray-700">{formatCurrency(previous.total_earnings)}</p>
              <p className="text-sm text-gray-600 mt-1">{previous.total_persons} employees</p>
            </div>
          </div>

          {/* Variance table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Variance Analysis</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Metric</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Current</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Previous</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Difference</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Total Earnings', cur: current.total_earnings, prev: previous.total_earnings, isCurrency: true },
                    { label: 'Total Net Pay', cur: current.total_net_pay, prev: previous.total_net_pay, isCurrency: true },
                    { label: 'Total Withholdings', cur: current.total_withholdings, prev: previous.total_withholdings, isCurrency: true },
                    { label: 'Total Deductions', cur: current.total_deductions, prev: previous.total_deductions, isCurrency: true },
                    { label: 'Total Hours', cur: current.total_hours, prev: previous.total_hours, isCurrency: false },
                    { label: 'Employees', cur: current.total_persons, prev: previous.total_persons, isCurrency: false },
                  ].map((row) => {
                    const { pct, diff } = calcChange(row.cur, row.prev)
                    const isPositive = diff >= 0
                    return (
                      <tr key={row.label} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{row.label}</td>
                        <td className="py-3 px-4 text-right">{row.isCurrency ? formatCurrency(row.cur) : formatNumber(row.cur)}</td>
                        <td className="py-3 px-4 text-right text-gray-600">{row.isCurrency ? formatCurrency(row.prev) : formatNumber(row.prev)}</td>
                        <td className={`py-3 px-4 text-right font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{row.isCurrency ? formatCurrency(diff) : formatNumber(diff)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}{pct.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {currentId && previousId && currentId === previousId && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm">
          Please select two different periods to compare.
        </div>
      )}
    </>
  )
}

export default function ComparisonPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container flex items-center justify-between py-4">
          <Link href="/dashboard" className="text-2xl font-bold">Payroll Dashboard</Link>
          <Link href="/dashboard" className="text-blue-500 hover:underline">Back to Dashboard</Link>
        </div>
      </nav>

      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Payroll Comparison</h1>
        <Suspense fallback={<div>Loading...</div>}>
          <ComparisonContent />
        </Suspense>
      </div>
    </div>
  )
}
