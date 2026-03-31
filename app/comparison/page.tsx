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
  total_persons: number
}

type PayrollEntry = {
  id: string
  employee_id: string
  total_hours: number
  total_earnings: number
  net_pay: number
}

function ComparisonContent() {
  const router = useRouter()
  const [periodId, setPeriodId] = useState<string | null>(null)
  const [current, setCurrent] = useState<PayrollPeriod | null>(null)
  const [previous, setPrevious] = useState<PayrollPeriod | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) router.push('/')
    }
    checkAuth()

    const params = new URLSearchParams(window.location.search)
    setPeriodId(params.get('periodId'))
  }, [router])

  useEffect(() => {
    const fetchComparison = async () => {
      if (!periodId) return
      try {
        const res = await fetch(`/api/comparison?periodId=${periodId}`)
        const data = await res.json()
        setCurrent(data.current)
        setPrevious(data.previous?.[0])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchComparison()
  }, [periodId])

  return (
    <>
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : current ? (
        <>
          {previous && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Current Period</h2>
                <div className="space-y-2">
                  <p className="text-gray-600">{current.period_start} to {current.period_end}</p>
                  <p className="text-2xl font-bold text-blue-600">${current.total_earnings.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">{current.total_persons} employees</p>
                </div>
              </div>
              <div className="card">
                <h2 className="text-xl font-bold mb-4">Previous Period</h2>
                <div className="space-y-2">
                  <p className="text-gray-600">{previous.period_start} to {previous.period_end}</p>
                  <p className="text-2xl font-bold text-blue-600">${previous.total_earnings.toFixed(2)}</p>
                  <p className="text-sm text-gray-600">{previous.total_persons} employees</p>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Variance Analysis</h2>
            {!previous ? (
              <p className="text-gray-500">No previous period for comparison</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Current</th>
                      <th>Previous</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-semibold">Total Earnings</td>
                      <td>${current.total_earnings.toFixed(2)}</td>
                      <td>${previous.total_earnings.toFixed(2)}</td>
                      <td className={current.total_earnings > previous.total_earnings ? 'text-green-600' : 'text-red-600'}>
                        {(((current.total_earnings - previous.total_earnings) / previous.total_earnings) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Total Net Pay</td>
                      <td>${current.total_net_pay.toFixed(2)}</td>
                      <td>${previous.total_net_pay.toFixed(2)}</td>
                      <td className={current.total_net_pay > previous.total_net_pay ? 'text-green-600' : 'text-red-600'}>
                        {(((current.total_net_pay - previous.total_net_pay) / previous.total_net_pay) * 100).toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Employees</td>
                      <td>{current.total_persons}</td>
                      <td>{previous.total_persons}</td>
                      <td className={current.total_persons > previous.total_persons ? 'text-green-600' : 'text-red-600'}>
                        {current.total_persons - previous.total_persons > 0 ? '+' : ''}{current.total_persons - previous.total_persons}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-12">Period not found</div>
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
