'use client'
import Link from 'next/link'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { usePayroll, PageTitle, Panel } from '@/components/PayrollWorkspace'
import {
  Summary,
  DiscrepancyList,
  Changes,
  Breakdown,
  Taxes,
} from '@/components/PayrollPanels'
import { previousPeriod, dateOnly, money, number } from '@/lib/payroll-domain'
import { PayrollHistoryCharts } from '@/components/PayrollHistoryCharts'
import { PayrollComposition } from '@/components/PayrollComposition'
import { PayrollSignals } from '@/components/PayrollSignals'
export default function Dashboard() {
  const { data, period, name } = usePayroll()
  if (!period)
    return (
      <>
        <PageTitle
          title="Your payroll workspace"
          description="Import a Paychex journal to understand payroll changes."
        />
        <Link className="pw-button pw-primary" href="/upload">
          Import first journal
        </Link>
      </>
    )
  const previous = previousPeriod(period, data.periods)
  const alerts = data.alerts.filter(
    (a) => a.current_period_id === period.id && a.severity !== 'info',
  )
  const trend = [...data.periods].reverse().map((p) => ({
    date: dateOnly(p.check_date),
    Overtime: p.breakdown.overtime_hours || 0,
    'Double Time': p.breakdown.double_time_hours || 0,
  }))
  const entries = data.entries.filter((e) => e.payroll_period_id === period.id)
  const departments = [...new Set(entries.map((e) => e.department))].map(
    (d) => ({
      department: d,
      entries: entries.filter((e) => e.department === d),
    }),
  )
  return (
    <>
      <PageTitle
        title="Payroll overview"
        description="Understand this payroll, spot unusual changes, and trace every total to its journal."
      />
      <Summary period={period} />
      <PayrollSignals period={period} />
      <PayrollComposition period={period} />
      <Panel
        title="Discrepancy worth checking"
        description={
          alerts.length
            ? String(alerts.length) +
              ' employee changes worth understanding. A flag does not mean the payroll is wrong.'
            : 'No unusual employee changes detected for this payroll.'
        }
        action={
          <Link className="pw-button" href="/discrepancies">
            See discrepancies →
          </Link>
        }
      >
        <DiscrepancyList alerts={alerts} limit={4} />
      </Panel>
      {previous && <Changes current={period} previous={previous} />}
      <div className="pw-grid-two">
        <Panel
          title="Overtime & Double Time trend"
          description="Reported hours by check date across imported payrolls."
        >
          <div className="pw-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ left: 0, right: 20, top: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={35} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Overtime"
                  stroke="#c66b08"
                  fill="#fff1d6"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="Double Time"
                  stroke="#c0265b"
                  fill="#fce7ef"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary>View trend values</summary>
            <div className="pw-scroll">
              <table className="pw-table">
                <thead>
                  <tr>
                    <th>Check date</th>
                    <th>OT hours</th>
                    <th>DT hours</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((t) => (
                    <tr key={t.date}>
                      <td>{t.date}</td>
                      <td>{number(t.Overtime)}</td>
                      <td>{number(t['Double Time'])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>
        <Panel
          title="By department"
          description="Employee count, hours and gross pay in the selected payroll."
        >
          <div className="pw-scroll">
            <table className="pw-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Employees</th>
                  <th>Hours</th>
                  <th>Gross pay</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.department}>
                    <td>Department {d.department}</td>
                    <td>{d.entries.length}</td>
                    <td>
                      {number(d.entries.reduce((n, e) => n + e.total_hours, 0))}
                    </td>
                    <td>
                      {money(
                        d.entries.reduce((n, e) => n + e.total_earnings, 0),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <PayrollHistoryCharts />
      <Panel
        title="Top 10 earners"
        description="Highest reported gross pay in the selected payroll."
        action={
          <Link className="pw-button" href="/employees">
            All employees →
          </Link>
        }
      >
        <div className="pw-scroll">
          <table className="pw-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Hours</th>
                <th>Gross</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {[...entries]
                .sort((a, b) => b.total_earnings - a.total_earnings)
                .slice(0, 10)
                .map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={'/employees/' + e.employee_id}>
                        {name(e.employee_id)}
                      </Link>
                    </td>
                    <td>{e.department}</td>
                    <td>{number(e.total_hours)}</td>
                    <td>{money(e.total_earnings)}</td>
                    <td>{money(e.net_pay)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Breakdown current={period} />
      <Taxes current={period} />
    </>
  )
}
