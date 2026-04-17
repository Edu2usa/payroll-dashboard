'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { ArrowLeftRight } from 'lucide-react'

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

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-8 pt-16 lg:pt-8">

          <div className="page-header">
            <h1>Payroll History</h1>
            <p>All uploaded payroll periods</p>
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
              </div>
            ) : periods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <p className="font-medium text-gray-500">No payroll periods found</p>
                <p className="text-sm mt-1">
                  <Link href="/upload" className="text-blue-600 hover:underline">Upload PDFs</Link> to get started
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Period</th>
                      <th className="hidden sm:table-cell">Check Date</th>
                      <th className="text-right hidden md:table-cell">Employees</th>
                      <th className="text-right">Earnings</th>
                      <th className="text-right hidden sm:table-cell">Net Pay</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p, idx) => (
                      <tr key={p.id}>
                        <td className="text-xs text-gray-400 font-medium">{idx + 1}</td>
                        <td>
                          <p className="text-sm font-medium text-gray-800">{p.period_start} — {p.period_end}</p>
                        </td>
                        <td className="hidden sm:table-cell text-sm text-gray-500">{p.check_date}</td>
                        <td className="hidden md:table-cell text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            {p.total_persons} emp
                          </span>
                        </td>
                        <td className="text-right text-sm font-semibold text-blue-600">{fmt(p.total_earnings)}</td>
                        <td className="text-right text-sm font-semibold text-emerald-600 hidden sm:table-cell">{fmt(p.total_net_pay)}</td>
                        <td className="text-right">
                          <Link
                            href={`/comparison?currentId=${p.id}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                          >
                            <ArrowLeftRight size={13} />
                            Compare
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
