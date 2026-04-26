'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppTopbar } from '@/components/AppTopbar'

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
    <div className="brand-page">
      <AppTopbar backHref="/dashboard" backLabel="Back to Dashboard" />

      <div className="container section-shell">
        <div className="page-title">
          <h1>Payroll History</h1>
          <p>Review prior payroll periods in the shared Preferred Maintenance visual system.</p>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="card surface-panel">
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
                        <td className="brand-money font-semibold">${p.total_earnings.toFixed(2)}</td>
                        <td className="text-green-600 font-semibold">${p.total_net_pay.toFixed(2)}</td>
                        <td><Link href={`/comparison?currentId=${p.id}`} className="emphasis-link">Compare</Link></td>
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
