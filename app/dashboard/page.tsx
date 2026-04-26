'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts'
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react'

interface DashboardData {
  latestPeriod: {
    id: string
    period_start: string
    period_end: string
    check_date: string
    total_earnings: number
    total_net_pay: number
    total_hours: number
    total_persons: number
    total_withholdings: number
    total_deductions: number
  }
  periodChange: {
    earnings_change_pct: number
    net_pay_change_pct: number
    hours_change_pct: number
    employees_change_pct: number
    withholdings_change_pct: number
  }
  departmentBreakdown: Array<{
    department: number
    earnings: number
    hours: number
    employees: number
  }>
  topEarners: Array<{
    name: string
    department: number
    hours: number
    earnings: number
    net_pay: number
  }>
  overtimeSummary: {
    total_ot_hours: number
    total_ot_earnings: number
    employees_with_ot: number
  }
  discrepancyCount: number
  allPeriods: Array<{
    id: string
    period_start: string
    period_end: string
    check_date: string
    total_earnings: number
    total_net_pay: number
    total_persons: number
    total_hours: number
    total_withholdings: number
    total_deductions: number
  }>
}

interface SummaryCard {
  label: string
  value: string
  change: number
  color: string
  icon?: React.ReactNode
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function ChangeIndicator({ change }: { change: number }) {
  const isPositive = change >= 0
  const color = isPositive ? 'text-green-600' : 'text-red-600'
  const Icon = isPositive ? TrendingUp : TrendingDown

  return (
    <div className={`flex items-center gap-1 ${color} text-sm font-semibold`}>
      <Icon size={16} />
      <span>{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
    </div>
  )
}

function SummaryCardComponent({ label, value, change, color }: SummaryCard) {
  return (
    <div className="surface-panel bg-white rounded-lg p-3 sm:p-6 border-l-4" style={{ borderColor: color }}>
      <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1 sm:mb-2">{label}</p>
      <p className="text-lg sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-3 truncate">{value}</p>
      <ChangeIndicator change={change} />
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [overtimeChartData, setOvertimeChartData] = useState<any[]>([])
  const [withholdingsChartData, setWithholdingsChartData] = useState<any[]>([])

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) router.push('/')
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) {
          throw new Error('Failed to fetch dashboard data')
        }
        const dashboardData: DashboardData = await res.json()
        setData(dashboardData)

        // Prepare chart data (showing recent 12 periods)
        const recentPeriods = dashboardData.allPeriods.slice(0, 12).reverse()
        const trendData = recentPeriods.map((period) => ({
          date: new Date(period.check_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          gross: period.total_earnings,
          net: period.total_net_pay,
        }))
        setChartData(trendData)

        // OT trend data not available per-period from summary endpoint
        // Leave overtimeChartData empty — summary stats shown above chart area
        setOvertimeChartData([])

        // Prepare withholdings chart data
        const whData = recentPeriods.map((period) => ({
          date: new Date(period.check_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          withholdings: period.total_withholdings,
          deductions: period.total_deductions,
        }))
        setWithholdingsChartData(whData)
      } catch (err) {
        console.error('Error fetching dashboard:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pm-brand"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="flex-1 lg:ml-72 p-4 sm:p-8 pt-16 lg:pt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="text-red-900 font-semibold mb-1">Error Loading Dashboard</h3>
              <p className="text-red-700">{error || 'Failed to load dashboard data'}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const avgEarningsPerEmployee = data.latestPeriod.total_persons > 0
    ? data.latestPeriod.total_earnings / data.latestPeriod.total_persons
    : 0

  const summaryCards: SummaryCard[] = [
    {
      label: 'Total Gross Earnings',
      value: formatCurrency(data.latestPeriod.total_earnings),
      change: data.periodChange.earnings_change_pct,
      color: '#cc2434',
    },
    {
      label: 'Total Net Pay',
      value: formatCurrency(data.latestPeriod.total_net_pay),
      change: data.periodChange.net_pay_change_pct,
      color: '#238a57',
    },
    {
      label: 'Total Hours',
      value: formatNumber(data.latestPeriod.total_hours),
      change: data.periodChange.hours_change_pct,
      color: '#b96e12',
    },
    {
      label: 'Employees',
      value: data.latestPeriod.total_persons.toString(),
      change: data.periodChange.employees_change_pct,
      color: '#241920',
    },
    {
      label: 'Total Withholdings',
      value: formatCurrency(data.latestPeriod.total_withholdings),
      change: data.periodChange.withholdings_change_pct,
      color: '#a61a27',
    },
    {
      label: 'Avg Earnings/Employee',
      value: formatCurrency(avgEarningsPerEmployee),
      change: 0,
      color: '#6c2f38',
    },
  ]

  const departmentColors = ['#cc2434', '#a61a27', '#6c2f38', '#241920', '#e88491', '#f6d3d8']

  const recentPeriods = data.allPeriods.slice(0, 5)

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />

      <div className="flex-1 lg:ml-72">
        <div className="p-4 sm:p-8 pt-16 lg:pt-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">
              Period: {data.latestPeriod.period_start} to {data.latestPeriod.period_end}
            </p>
          </div>

          {/* Row 1: Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
            {summaryCards.map((card, idx) => (
              <SummaryCardComponent key={idx} {...card} />
            ))}
          </div>

          {/* Row 2: Payroll Trend & Department Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 mb-8">
            <div className="lg:col-span-2 surface-panel bg-white rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Payroll Trend</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#CC2434" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#CC2434" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6C2F38" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#6C2F38" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                      }}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="gross"
                      stroke="#CC2434"
                      fillOpacity={1}
                      fill="url(#colorGross)"
                      name="Gross"
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke="#6C2F38"
                      fillOpacity={1}
                      fill="url(#colorNet)"
                      name="Net"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">No data available</div>
              )}
            </div>

            <div className="surface-panel bg-white rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Department Breakdown</h2>
              {data.departmentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.departmentBreakdown}
                      dataKey="earnings"
                      nameKey="department"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={false}
                    >
                      {data.departmentBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={departmentColors[index % departmentColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend
                      formatter={(value, entry: any) => {
                        const item = data.departmentBreakdown.find(d => d.department === Number(value))
                        return `Dept ${value}: ${item ? formatCurrency(item.earnings) : ''}`
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">No data available</div>
              )}
            </div>
          </div>

          {/* Row 3: Overtime & Withholdings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-8">
            <div className="surface-panel bg-white rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Overtime Analysis</h2>
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">OT Hours</p>
                  <p className="text-2xl font-bold text-pm-brand">
                    {formatNumber(data.overtimeSummary.total_ot_hours)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">OT Earnings</p>
                  <p className="text-2xl font-bold text-pm-brand">
                    {formatCurrency(data.overtimeSummary.total_ot_earnings)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Employees</p>
                  <p className="text-2xl font-bold text-pm-brand">
                    {data.overtimeSummary.employees_with_ot}
                  </p>
                </div>
              </div>
              {overtimeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={overtimeChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                      }}
                    />
                    <Bar dataKey="hours" fill="#CC2434" name="OT Hours" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">OT trend chart available after more periods are uploaded</div>
              )}
            </div>

            <div className="surface-panel bg-white rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Withholdings vs Deductions</h2>
              {withholdingsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={withholdingsChartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#6B7280" />
                    <YAxis stroke="#6B7280" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                      }}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend />
                    <Bar dataKey="withholdings" fill="#A61A27" name="Withholdings" stackId="a" />
                    <Bar dataKey="deductions" fill="#6C2F38" name="Deductions" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">No data available</div>
              )}
            </div>
          </div>

          {/* Row 4: Top Earners & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            <div className="lg:col-span-2 surface-panel bg-white rounded-lg p-4 sm:p-6 overflow-x-auto">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Top 10 Earners</h2>
              {data.topEarners.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Department</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Hours</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Earnings</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topEarners.map((earner, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">{earner.name}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">Department {earner.department || 'N/A'}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 text-right">{formatNumber(earner.hours)}</td>
                          <td className="py-3 px-4 text-sm font-semibold text-pm-brand text-right">
                            {formatCurrency(earner.earnings)}
                          </td>
                          <td className="py-3 px-4 text-sm font-semibold text-green-600 text-right">
                            {formatCurrency(earner.net_pay)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">No earner data available</div>
              )}
            </div>

            <div className="surface-panel bg-white rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Recent Activity</h2>

              {data.discrepancyCount > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="font-semibold text-red-900">Unreviewed Discrepancies</p>
                      <p className="text-red-700 text-sm mt-1">{data.discrepancyCount} items need review</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700 mb-4">Recent Periods</p>
                {recentPeriods.map((period, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      {new Date(period.check_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-600 mb-2">
                      {period.period_start} to {period.period_end}
                    </p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600">{period.total_persons} employees</span>
                      <span className="font-semibold text-pm-brand">{formatCurrency(period.total_earnings)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
