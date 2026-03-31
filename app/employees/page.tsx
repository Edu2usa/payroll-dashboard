'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container px-4 sm:px-6 flex items-center justify-between py-3 sm:py-4">
          <Link href="/dashboard" className="text-lg sm:text-2xl font-bold">Payroll Dashboard</Link>
          <Link href="/dashboard" className="text-sm sm:text-base text-blue-500 hover:underline">Back to Dashboard</Link>
        </div>
      </nav>

      <div className="container px-4 sm:px-6 py-4 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Employees</h1>

        <div className="card mb-6">
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
          <div className="card">
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
                        <td><Link href={`/employees/${emp.id}`} className="text-blue-500 hover:underline">View</Link></td>
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
