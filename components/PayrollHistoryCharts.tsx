'use client'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { Panel, usePayroll, downloadCSV } from './PayrollWorkspace'
import { dateOnly, money } from '@/lib/payroll-domain'
export function PayrollHistoryCharts() {
  const { data, period } = usePayroll()
  const rows = [...data.periods].reverse().map((p) => ({
    date: dateOnly(p.check_date),
    Gross: p.total_earnings,
    Net: p.total_net_pay,
    Withholdings: p.total_withholdings,
    Deductions: p.total_deductions,
  }))
  return (
    <div className="pw-grid-two">
      {[
        { title: 'Payroll trend', keys: ['Gross', 'Net'] },
        {
          title: 'Withholdings & deductions trend',
          keys: ['Withholdings', 'Deductions'],
        },
      ].map(({ title, keys }) => (
        <Panel
          key={title}
          title={title}
          description="Reported amounts by check date across imported payrolls."
          action={
            <button
              onClick={() =>
                downloadCSV(title + '.csv', [
                  ['Check date', ...keys],
                  ...rows.map((r) => [
                    r.date,
                    ...keys.map((k) => (r as any)[k]),
                  ]),
                ])
              }
            >
              Export CSV
            </button>
          }
        >
          <div className="pw-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ left: 8, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={35} />
                <YAxis
                  tickFormatter={(v) => '$' + Math.round(v / 1000) + 'k'}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(v: number) => money(v)} />
                <Legend />
                {period && (
                  <ReferenceLine
                    x={dateOnly(period.check_date)}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Selected',
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: '#64748b',
                    }}
                  />
                )}
                {keys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={i ? '#0d9488' : '#2563eb'}
                    strokeWidth={3}
                    dot={{ r: 2, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: 'white', strokeWidth: 2 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details>
            <summary>View trend values</summary>
            <div className="pw-scroll">
              <table className="pw-table">
                <thead>
                  <tr>
                    <th>Check date</th>
                    {keys.map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      {keys.map((k) => (
                        <td key={k}>{money((r as any)[k])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>
      ))}
    </div>
  )
}
