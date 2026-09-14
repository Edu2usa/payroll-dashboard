'use client'
import { useState } from 'react'
import Link from 'next/link'
import {
  usePayroll,
  PageTitle,
  Panel,
  downloadCSV,
} from '@/components/PayrollWorkspace'
import { money, number, dateOnly } from '@/lib/payroll-domain'
export default function Employees() {
  const { data, period, name } = usePayroll(),
    [search, setSearch] = useState(''),
    [department, setDepartment] = useState(''),
    [scope, setScope] = useState('period')
  const entries = data.entries.filter(
      (e) => e.payroll_period_id === period?.id,
    ),
    byEmployee = new Map(entries.map((e) => [e.employee_id, e]))
  const rows = data.employees
    .filter(
      (e) =>
        (scope === 'all' || byEmployee.has(e.id)) &&
        (!department ||
          String(byEmployee.get(e.id)?.department ?? e.department) ===
            department) &&
        (name(e.id) + ' ' + e.employee_id)
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => name(a.id).localeCompare(name(b.id)))
  return (
    <>
      <PageTitle
        title="Employees"
        description="Payroll appearances and reported pay. Employment status must be verified separately."
      />
      <Panel
        title={rows.length + ' employees'}
        action={
          <button
            onClick={() =>
              downloadCSV('employees.csv', [
                [
                  'Employee number',
                  'Name',
                  'Department',
                  'First payroll',
                  'Last payroll',
                  'Selected period hours',
                  'Selected period gross',
                ],
                ...rows.map((e) => [
                  e.employee_id,
                  name(e.id),
                  byEmployee.get(e.id)?.department ?? e.department,
                  e.first_seen,
                  e.last_seen,
                  byEmployee.get(e.id)?.total_hours ?? '',
                  byEmployee.get(e.id)?.total_earnings ?? '',
                ]),
              ])
            }
          >
            Export CSV
          </button>
        }
      >
        <div className="pw-toolbar">
          <label>
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or employee number"
            />
          </label>
          <label>
            Scope
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="period">Selected payroll</option>
              <option value="all">All imported employees</option>
            </select>
          </label>
          <label>
            Department
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {[...new Set(data.entries.map((e) => e.department))]
                .sort()
                .map((d) => (
                  <option key={d}>{d}</option>
                ))}
            </select>
          </label>
        </div>
        <div className="pw-scroll">
          <table className="pw-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Number</th>
                <th>Department</th>
                <th>Hours</th>
                <th>Gross pay</th>
                <th>Net pay</th>
                <th>First payroll</th>
                <th>Last payroll</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const entry = byEmployee.get(e.id)
                return (
                  <tr key={e.id}>
                    <td>
                      <Link href={'/employees/' + e.id}>{name(e.id)}</Link>
                    </td>
                    <td>{e.employee_id}</td>
                    <td>{entry?.department ?? e.department}</td>
                    <td>{entry ? number(entry.total_hours) : '—'}</td>
                    <td>{entry ? money(entry.total_earnings) : '—'}</td>
                    <td>{entry ? money(entry.net_pay) : '—'}</td>
                    <td>{dateOnly(e.first_seen)}</td>
                    <td>{dateOnly(e.last_seen)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="pw-empty">No employees match these filters.</p>
        )}
      </Panel>
    </>
  )
}
