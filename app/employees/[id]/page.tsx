'use client'
import Link from 'next/link'
import {
  usePayroll,
  PageTitle,
  Panel,
  downloadCSV,
} from '@/components/PayrollWorkspace'
import { DiscrepancyList } from '@/components/PayrollPanels'
import { money, number, dateOnly, periodLabel } from '@/lib/payroll-domain'
export default function Employee({ params }: { params: { id: string } }) {
  const { data, period, name } = usePayroll(),
    employee = data.employees.find((e) => e.id === params.id)
  if (!employee)
    return (
      <PageTitle
        title="Employee not found"
        description="Return to Employees and choose an imported employee."
      />
    )
  const rows = data.entries
    .filter((e) => e.employee_id === params.id)
    .map((e) => ({
      ...e,
      period: data.periods.find((p) => p.id === e.payroll_period_id)!,
    }))
    .sort((a, b) => b.period.period_end.localeCompare(a.period.period_end))
  return (
    <>
      <PageTitle
        title={name(employee.id)}
        description={
          'Employee ' +
          employee.employee_id +
          ' · First payroll ' +
          dateOnly(employee.first_seen) +
          ' · Last payroll ' +
          dateOnly(employee.last_seen)
        }
      />
      <Panel
        title="Payroll history"
        description="Dates describe observed payrolls, not hire or termination dates. Average regular pay per hour includes all reported regular earning lines."
        action={
          <button
            onClick={() =>
              downloadCSV('employee-payroll-history.csv', [
                [
                  'Period start',
                  'Period end',
                  'Check date',
                  'Department',
                  'Hours',
                  'Gross',
                  'Net',
                  'Regular hours',
                  'Regular earnings',
                  'OT hours',
                  'OT earnings',
                  'DT hours',
                  'DT earnings',
                ],
                ...rows.map((e) => [
                  e.period.period_start,
                  e.period.period_end,
                  e.period.check_date,
                  e.department,
                  e.total_hours,
                  e.total_earnings,
                  e.net_pay,
                  e.regular_hours,
                  e.regular_earnings,
                  e.overtime_hours,
                  e.overtime_earnings,
                  e.double_time_hours,
                  e.double_time_earnings,
                ]),
              ])
            }
          >
            Export CSV
          </button>
        }
      >
        <div className="pw-scroll">
          <table className="pw-table">
            <thead>
              <tr>
                <th>Pay period</th>
                <th>Check date</th>
                <th>Department</th>
                <th>Total hours</th>
                <th>Gross</th>
                <th>Net</th>
                <th>Regular avg. $/h</th>
                <th>OT hours</th>
                <th>DT hours</th>
                <th>Deductions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link
                      href={
                        '/source/' +
                        e.payroll_period_id +
                        '?employee=' +
                        employee.id
                      }
                    >
                      {periodLabel(e.period)}
                    </Link>
                  </td>
                  <td>{dateOnly(e.period.check_date)}</td>
                  <td>{e.department}</td>
                  <td>{number(e.total_hours)}</td>
                  <td>{money(e.total_earnings)}</td>
                  <td>{money(e.net_pay)}</td>
                  <td>
                    {e.regular_hours > 0
                      ? money(e.regular_earnings / e.regular_hours)
                      : '—'}
                  </td>
                  <td>{number(e.overtime_hours)}</td>
                  <td>{number(e.double_time_hours)}</td>
                  <td>{money(e.total_deductions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Discrepancies in selected payroll">
        <DiscrepancyList
          alerts={data.alerts.filter(
            (a) =>
              a.employee_id === params.id && a.current_period_id === period?.id,
          )}
        />
      </Panel>
    </>
  )
}
