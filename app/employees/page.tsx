'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { Search, ChevronRight } from 'lucide-react'

type Employee = {
  id: string
  employee_id: number
  last_name: string
  first_name: string
  middle_initial: string
  department: number
  last_seen: string
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
      {initials}
    </div>
  )
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
        const url = search ? `/api/employees?search=${encodeURIComponent(search)}` : '/api/employees'
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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-8 pt-16 lg:pt-8">

          <div className="page-header">
            <h1>Employees</h1>
            <p>Browse and search all payroll employees</p>
          </div>

          <div className="card mb-5 p-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={15} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by name or employee ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white placeholder-gray-400"
              />
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div>
              </div>
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <p className="font-medium text-gray-500">No employees found</p>
                <p className="text-sm mt-1">{search ? 'Try a different search term' : 'No employees in the database'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th className="hidden sm:table-cell">ID</th>
                      <th className="hidden md:table-cell">Department</th>
                      <th className="hidden lg:table-cell">Last Seen</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const fullName = `${emp.first_name} ${emp.last_name}`
                      return (
                        <tr key={emp.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <Avatar name={fullName} />
                              <div>
                                <p className="font-medium text-gray-900 text-sm">
                                  {emp.last_name}, {emp.first_name}{emp.middle_initial ? ' ' + emp.middle_initial : ''}
                                </p>
                                <p className="text-xs text-gray-400 sm:hidden">#{emp.employee_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell">
                            <span className="font-mono text-xs text-gray-500">#{emp.employee_id}</span>
                          </td>
                          <td className="hidden md:table-cell">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              Dept {emp.department}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell text-gray-500 text-sm">{emp.last_seen}</td>
                          <td className="text-right">
                            <Link
                              href={`/employees/${emp.id}`}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                            >
                              View <ChevronRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
