'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  AlertCircle, TrendingDown, TrendingUp,
  DollarSign, CreditCard, Clock, Users, Banknote, BarChart3
} from 'lucide-react'

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
  icon: React.ElementType
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
  const color = isPositive ? 'text-emerald-600' : 'text-red-500'
  const bg = isPositive ? 'bg-emerald-50' : 'bg-red-50'
  const Icon = isPositive ? TrendingUp : TrendingDown

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${color} ${bg}`}>
      <Icon size={11} />
      <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
    </div>
  )
}

function KpiCard({ label, value, change, color, icon: Icon }: SummaryCard) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: color + '18' }}>
          <Icon size={18} style={{ color }} />
        </div>
        <ChangeIndicator change={change} />
      </div>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 truncate">{value}</p>
      <p className="text-xs font-medium text-gray-500">{label}</p>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 lg:ml-64 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-gray-500 text-sm">Loading dashboard...</p>
        </div>
      </div>
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
        if (!res.ok) throw new Error('Failed to fetch dashboard data')
        const dashboardData: DashboardData = await res.json()
        setData(dashboardData)

        const recentPeriods = dashboardData.allPeriods.slice(0, 12).reverse()
        setChartData(recentPeriods.map((p) => ({
          date: new Date(p.check_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          gross: p.total_earnings,
          net: p.total_net_pay,
        })))
        setOvertimeChartData([])
        setWithholdingsChartData(recentPeriods.map((p) => ({
          date: new Date(p.check_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          withholdings: p.total_withholdings,
          deductions: p.total_deductions,
        })))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  if (loading) return <Spinner />

  if (error || !data) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 lg:ml-64 p-4 sm:p-8 pt-16 lg:pt-8">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-4">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="text-red-900 font-semibold mb-1">Error Loading Dashboard</h3>
              <p className="text-red-700 text-sm">{error || 'Failed to load dashboard data'}</p>
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
    { label: 'Gross Earnings', value: formatCurrency(data.latestPeriod.total_earnings), change: data.periodChange.earnings_change_pct, color: '#3B82F6', icon: DollarSign },
    { label: 'Net Pay', value: formatCurrency(data.latestPeriod.total_net_pay), change: data.periodChange.net_pay_change_pct, color: '#10B981', icon: CreditCard },
    { label: 'Total Hours', value: formatNumber(data.latestPeriod.total_hours), change: data.periodChange.hours_change_pct, color: '#F59E0B', icon: Clock },
    { label: 'Employees', value: data.latestPeriod.total_persons.toString(), change: data.periodChange.employees_change_pct, color: '#8B5CF6', icon: Users },
    { label: 'Withholdings', value: formatCurrency(data.latestPeriod.total_withholdings), change: data.periodChange.withholdings_change_pct, color: '#EF4444', icon: Banknote },
    { label: 'Avg per Employee', value: formatCurrency(avgEarningsPerEmployee), change: 0, color: '#06B6D4', icon: BarChart3 },
  ]

  const departmentColors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4']
  const recentPeriods = data.allPeriods.slice(0, 5)

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1E293B', border: 'none', borderRadius: '8px', color: '#F8FAFC', fontSize: '12px' },
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-8 pt-16 lg:pt-8">

          <div className="page-header">
            <h1>Dashboard</h1>
            <p>Period: {data.latestPeriod.period_start} — {data.latestPeriod.period_end}</p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
            {summaryCards.map((card, idx) => (
              <KpiCard key={idx} {...card} />
            ))}
          </div>

          {/* Payroll Trend & Department Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="lg:col-span-2 card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-5">Payroll Trend</h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                    <Tooltip {...tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" dataKey="gross" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorGross)" name="Gross" />
                    <Area type="monotone" dataKey="net" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorNet)" name="Net" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">No data available</div>
              )}
            </div>

            <div className="card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-5">Department Breakdown</h2>
              {data.departmentBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.departmentBreakdown} dataKey="earnings" nameKey="department" cx="50%" cy="45%" outerRadius={90} label={false}>
                      {data.departmentBreakdown.map((_, i) => (
                        <Cell key={i} fill={departmentColors[i % departmentColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={tooltipStyle.contentStyle} />
                    <Legend
                      wrapperStyle={{ fontSize: '11px' }}
                      formatter={(value) => {
                        const item = data.departmentBreakdown.find(d => d.department === Number(value))
                        return `Dept ${value}: ${item ? formatCurrency(item.earnings) : ''}`
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">No data available</div>
              )}
            </div>
          </div>

          {/* Overtime & Withholdings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <div className="card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Overtime Analysis</h2>
              <div className="grid grid-cols-3 gap-4 mb-5">
                {[
                  { label: 'OT Hours', value: formatNumber(data.overtimeSummary.total_ot_hours) },
                  { label: 'OT Earnings', value: formatCurrency(data.overtimeSummary.total_ot_earnings) },
                  { label: 'Employees', value: data.overtimeSummary.employees_with_ot.toString() },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-amber-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-amber-700 font-medium mb-1">{label}</p>
                    <p className="text-lg font-bold text-amber-800 truncate">{value}</p>
                  </div>
                ))}
              </div>
              {overtimeChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={overtimeChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="hours" fill="#F59E0B" name="OT Hours" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[100px] text-gray-400 text-xs text-center px-4">
                  OT trend chart available after more periods are uploaded
                </div>
              )}
            </div>

            <div className="card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-5">Withholdings vs Deductions</h2>
              {withholdingsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={withholdingsChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94A3B8" tick={{ fontSize: 11 }} />
                    <Tooltip {...tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="withholdings" fill="#EF4444" name="Withholdings" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="deductions" fill="#06B6D4" name="Deductions" stackId="a" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-gray-400 text-sm">No data available</div>
              )}
            </div>
          </div>

          {/* Top Earners & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Top 10 Earners</h2>
              {data.topEarners.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">#</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Name</th>
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Dept</th>
                        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Hours</th>
                        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Earnings</th>
                        <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Net Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topEarners.map((earner, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-3 text-xs text-gray-400 font-medium">{idx + 1}</td>
                          <td className="py-3 px-3 text-sm text-gray-900 font-medium">{earner.name}</td>
                          <td className="py-3 px-3 hidden sm:table-cell">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Dept {earner.department || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-sm text-gray-500 text-right hidden sm:table-cell">{formatNumber(earner.hours)}</td>
                          <td className="py-3 px-3 text-sm font-semibold text-blue-600 text-right">{formatCurrency(earner.earnings)}</td>
                          <td className="py-3 px-3 text-sm font-semibold text-emerald-600 text-right">{formatCurrency(earner.net_pay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No earner data available</div>
              )}
            </div>

            <div className="card p-4 sm:p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Activity</h2>

              {data.discrepancyCount > 0 && (
                <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-sm font-semibold text-red-900">Unreviewed Discrepancies</p>
                    <p className="text-red-700 text-xs mt-0.5">{data.discrepancyCount} items need review</p>
                  </div>
                </div>
              )}

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Recent Periods</p>
              <div className="space-y-2">
                {recentPeriods.map((period, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(period.check_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <span className="text-xs font-semibold text-blue-600">{formatCurrency(period.total_earnings)}</span>
                    </div>
                    <p className="text-xs text-gray-500">{period.period_start} — {period.period_end}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{period.total_persons} employees</p>
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
