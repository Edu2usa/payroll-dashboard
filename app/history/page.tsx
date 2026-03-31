'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type PayrollPeriod = {
  id: string
  period_start: string
  period_end: string
  check_date: string
  total_earnings: number
  total_net_pay: number
  total_persons: number
  created_at: string
}

export default function HistoryPage() {
  const router = useRouter()
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [loading, setLoading] = useState(true)

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
        const res = await fetch('/api/payroll-periods?limit=100')
        const data = await res.json()
        setPeriods(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPeriods()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container px-4 sm:px-6 flex items-center justify-between py-3 sm:py-4">
          <Link href="/dashboard" className="text-lg sm:text-2xl font-bold">Payroll Dashboard</Link>
          <Link href="/dashboard" className="text-sm sm:text-base text-blue-500 hover:underline">Back to Dashboard</Link>
        </div>
      </nav>

      <div className="container px-4 sm:px-6 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Payroll History</h1>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="card">
            {periods.length === 0 ? (
              <p className="text-center py-12 text-gray-500">No payroll periods found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Check Date</th>
                      <th>Employees</th>
                      <th>Earnings</th>
                      <th>Net Pay</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(p => (
                      <tr key={p.id}>
                        <td className="text-sm">{p.period_start} to {p.period_end}</td>
                        <td>{p.check_date}</td>
                        <td>{p.total_persons}</td>
                        <td className="text-blue-600 font-semibold">${p.total_earnings.toFixed(2)}</td>
                        <td className="text-green-600 font-semibold">${p.total_net_pay.toFixed(2)}</td>
                        <td><Link href={`/comparison?currentId=${p.id}`} className="text-blue-500 hover:underline">Compare</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
