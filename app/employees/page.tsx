'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppTopbar } from '@/components/AppTopbar'

type Employee = {
  id: string
  employee_id: number
  last_name: string
  first_name: string
  middle_initial: string
  department: number
  last_seen: string
}

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) router.push('/')
    }
    checkAuth()
  }, [router])

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const url = search
          ? `/api/employees?search=${encodeURIComponent(search)}`
          : '/api/employees'
        const res = await fetch(url)
        const data = await res.json()
        setEmployees(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      setLoading(true)
      fetchEmployees()
    }, search ? 300 : 0)

    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="brand-page">
      <AppTopbar backHref="/dashboard" backLabel="Back to Dashboard" />

      <div className="container section-shell">
        <div className="page-title">
          <h1>Employees</h1>
          <p>Search and open payroll employee records with the updated Preferred Maintenance brand system.</p>
        </div>

        <div className="card surface-panel mb-6">
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
          />
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="card surface-panel">
            {employees.length === 0 ? (
              <p className="text-center py-12 text-gray-500">No employees found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Rate</th>
                      <th>Last Seen</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => (
                      <tr key={emp.id}>
                        <td className="font-mono">{emp.employee_id}</td>
                        <td>{emp.last_name}, {emp.first_name}{emp.middle_initial ? ' ' + emp.middle_initial : ''}</td>
                        <td>Dept {emp.department}</td>
                        <td className="text-gray-600">-</td>
                        <td>{emp.last_seen}</td>
                        <td><Link href={`/employees/${emp.id}`} className="emphasis-link">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
