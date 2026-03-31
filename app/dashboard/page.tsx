'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type PayrollPeriod = {
  id: string
  period_start: string
  period_end: string
  check_date: string
  total_gross: number
  total_net: number
  employee_count: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState([])

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
        const res = await fetch('/api/payroll-periods?limit=12')
        const data = await res.json()
        setPeriods(data)
        setChartData(data.reverse().map((p: PayrollPeriod) => ({
          date: p.check_date,
          gross: p.total_gross,
          net: p.total_net,
        })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPeriods()
  }, [])

  const currentPeriod = periods[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container flex items-center justify-between py-4">
          <h1 className="text-2xl font-bold">Payroll Dashboard</h1>
          <div className="flex gap-4">
            <Link href="/upload" className="btn btn-primary">Upload PDF</Link>
            <Link href="/" className="btn btn-secondary" onClick={() => {
              document.cookie = 'payroll_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
            }}>Logout</Link>
          </div>
        </div>
      </nav>

      <div className="container py-8">
        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <>
            {currentPeriod && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="card">
                  <p className="text-gray-600 text-sm">Total Gross</p>
                  <p className="text-3xl font-bold text-blue-600">${currentPeriod.total_gross.toFixed(2)}</p>
                </div>
                <div className="card">
                  <p className="text-gray-600 text-sm">Total Net</p>
                  <p className="text-3xl font-bold text-green-600">${currentPeriod.total_net.toFixed(2)}</p>
                </div>
                <div className="card">
                  <p className="text-gray-600 text-sm">Employees</p>
                  <p className="text-3xl font-bold">{currentPeriod.employee_count}</p>
                </div>
                <div className="card">
                  <p className="text-gray-600 text-sm">Period</p>
                  <p className="text-lg font-semibold">{currentPeriod.period_start} to {currentPeriod.period_end}</p>
                </div>
              </div>
            )}

            <div className="card mb-8">
              <h2 className="text-xl font-bold mb-4">Payroll Trend</h2>
              {chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                    <Legend />
                    <Line type="monotone" dataKey="gross" stroke="#3b82f6" name="Gross" />
                    <Line type="monotone" dataKey="net" stroke="#10b981" name="Net" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="card">
                  <h2 className="text-xl font-bold mb-4">Recent Payroll Periods</h2>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Period</th>
                          <th>Check Date</th>
                          <th>Employees</th>
                          <th>Gross</th>
                          <th>Net</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.slice(0, 5).map(p => (
                          <tr key={p.id}>
                            <td>{p.period_start} to {p.period_end}</td>
                            <td>{p.check_date}</td>
                            <td>{p.employee_count}</td>
                            <td className="text-blue-600 font-semibold">${p.total_gross.toFixed(2)}</td>
                            <td className="text-green-600 font-semibold">${p.total_net.toFixed(2)}</td>
                            <td><Link href={`/comparison?periodId=${p.id}`} className="text-blue-500 hover:underline">View</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="card">
                  <h3 className="font-bold mb-3">Quick Links</h3>
                  <div className="space-y-2">
                    <Link href="/upload" className="block p-2 bg-blue-50 hover:bg-blue-100 rounded">Upload PDF</Link>
                    <Link href="/employees" className="block p-2 bg-blue-50 hover:bg-blue-100 rounded">View Employees</Link>
                    <Link href="/history" className="block p-2 bg-blue-50 hover:bg-blue-100 rounded">History</Link>
                    <Link href="/settings" className="block p-2 bg-blue-50 hover:bg-blue-100 rounded">Settings</Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
