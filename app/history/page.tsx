'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type PayrollPeriod = {
  id: string
  period_start: string
  period_end: string
  check_date: string
  total_gross: number
  total_net: number
  employee_count: number
  pdf_filename: string
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
        <div className="container flex items-center justify-between py-4">
          <Link href="/dashboard" className="text-2xl font-bold">Payroll Dashboard</Link>
          <Link href="/dashboard" className="text-blue-500 hover:underline">Back to Dashboard</Link>
        </div>
      </nav>

      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Payroll History</h1>

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
                      <th>Gross</th>
                      <th>Net</th>
                      <th>PDF</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(p => (
                      <tr key={p.id}>
                        <td className="text-sm">{p.period_start} to {p.period_end}</td>
                        <td>{p.check_date}</td>
                        <td>{p.employee_count}</td>
                        <td className="text-blue-600 font-semibold">${p.total_gross.toFixed(2)}</td>
                        <td className="text-green-600 font-semibold">${p.total_net.toFixed(2)}</td>
                        <td className="text-xs text-gray-500">{p.pdf_filename}</td>
                        <td><Link href={`/comparison?periodId=${p.id}`} className="text-blue-500 hover:underline">Compare</Link></td>
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
