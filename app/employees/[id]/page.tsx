'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container px-4 sm:px-6 flex items-center justify-between py-3 sm:py-4">
          <Link href="/dashboard" className="text-lg sm:text-2xl font-bold">Payroll Dashboard</Link>
          <Link href="/employees" className="text-sm sm:text-base text-blue-500 hover:underline">Back to Employees</Link>
        </div>
      </nav>

      <div className="container px-4 sm:px-6 py-4 sm:py-8">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : employee ? (
          <>
            <div className="card mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold mb-4">{employee.last_name}, {employee.first_name}{employee.middle_initial ? ' ' + employee.middle_initial : ''}</h1>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-600 text-sm">Employee ID</p>
                  <p className="font-mono font-semibold">{employee.employee_id}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Department</p>
                  <p className="font-semibold">{employee.department}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Hire Date</p>
                  <p className="font-semibold">{employee.first_seen}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Last Seen</p>
                  <p className="font-semibold">{employee.last_seen}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold mb-4">Pay History</h2>
              {entries.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No payroll entries</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Hours</th>
                        <th>Earnings</th>
                        <th>Withholdings</th>
                        <th>Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(e => (
                        <tr key={e.id}>
                          <td>{e.payroll_periods.period_start} to {e.payroll_periods.period_end}</td>
                          <td>{e.total_hours.toFixed(2)}</td>
                          <td className="text-blue-600">${e.total_earnings.toFixed(2)}</td>
                          <td className="text-red-600">${e.total_withholdings.toFixed(2)}</td>
                          <td className="text-green-600 font-semibold">${e.net_pay.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">Employee not found</div>
        )}
      </div>
    </div>
  )
}
