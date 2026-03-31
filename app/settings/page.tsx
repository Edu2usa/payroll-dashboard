'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SettingsPage() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const res = await fetch('/api/auth/session')
      if (!res.ok) router.push('/')
    }
    checkAuth()
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="container flex items-center justify-between py-4">
          <Link href="/dashboard" className="text-2xl font-bold">Payroll Dashboard</Link>
          <Link href="/dashboard" className="text-blue-500 hover:underline">Back to Dashboard</Link>
        </div>
      </nav>

      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>

        <div className="max-w-2xl">
          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4">Application</h2>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-700 mb-2">Company Name</p>
                <p className="text-gray-600">Preferred Maintenance, LLC</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-2">Location</p>
                <p className="text-gray-600">Connecticut</p>
              </div>
            </div>
          </div>

          <div className="card mb-6">
            <h2 className="text-xl font-bold mb-4">Data</h2>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-gray-700 mb-2">Database</p>
                <p className="text-gray-600">Supabase PostgreSQL</p>
              </div>
              <div>
                <p className="font-semibold text-gray-700 mb-2">API Authentication</p>
                <p className="text-gray-600">X-API-Key Header</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Account</h2>
            <button
              onClick={handleLogout}
              className="btn btn-danger"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
