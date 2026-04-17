'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { ArrowLeft, Building2, CalendarDays, Clock } from 'lucide-react'

type Employee = {
  id: string
  employee_id: number
  last_name: string
  first_name: string
  middle_initial: string
  department: number
  first_seen: string
  last_seen: string
}

type PayrollEntry = {
  id: string
  payroll_period_id: string
  payroll_periods: { period_start: string; period_end: string; check_date: string }
  total_hours: number
  total_earnings: number
  total_withholdings: number
  net_pay: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function EmployeeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) router.push('/')
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/employees/${params.id}`)
        const data = await res.json()
        setEmployee(data)
        setEntries(data.entries || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (params.id) fetchData()
  }, [params.id])

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-8 pt-16 lg:pt-8">

          <div className="mb-6">
            <Link href="/employees" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4">
              <ArrowLeft size={14} />
              Back to Employees
            </Link>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
              </div>
            ) : employee ? (
              <>
                {/* Profile card */}
                <div className="card mb-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700 flex-shrink-0">
                      {employee.first_name[0]}{employee.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                        {employee.last_name}, {employee.first_name}{employee.middle_initial ? ' ' + employee.middle_initial : ''}
                      </h1>
                      <div className="flex flex-wrap gap-3 mt-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">#{employee.employee_id}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Building2 size={14} className="text-gray-400" />
                          <span>Department {employee.department}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <CalendarDays size={14} className="text-gray-400" />
                          <span>First seen {employee.first_seen}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Clock size={14} className="text-gray-400" />
                          <span>Last seen {employee.last_seen}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pay history */}
                <div className="card p-0 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">Pay History</h2>
                    <p className="text-sm text-gray-500 mt-0.5">{entries.length} payroll {entries.length === 1 ? 'period' : 'periods'}</p>
                  </div>
                  {entries.length === 0 ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">No payroll entries found</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Period</th>
                            <th className="text-right">Hours</th>
                            <th className="text-right">Earnings</th>
                            <th className="text-right hidden sm:table-cell">Withholdings</th>
                            <th className="text-right">Net Pay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(e => (
                            <tr key={e.id}>
                              <td>
                                <p className="text-sm font-medium text-gray-700">{e.payroll_periods.period_start} — {e.payroll_periods.period_end}</p>
                                <p className="text-xs text-gray-400">Check: {e.payroll_periods.check_date}</p>
                              </td>
                              <td className="text-right text-sm text-gray-600">{e.total_hours.toFixed(2)}</td>
                              <td className="text-right text-sm font-semibold text-blue-600">{fmt(e.total_earnings)}</td>
                              <td className="text-right text-sm text-red-500 hidden sm:table-cell">{fmt(e.total_withholdings)}</td>
                              <td className="text-right text-sm font-bold text-emerald-600">{fmt(e.net_pay)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card text-center py-16 text-gray-400">Employee not found</div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
