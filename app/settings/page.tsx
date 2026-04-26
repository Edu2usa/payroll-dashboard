'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppTopbar } from '@/components/AppTopbar'

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
    <div className="brand-page">
      <AppTopbar backHref="/dashboard" backLabel="Back to Dashboard" />

      <div className="container section-shell">
        <div className="page-title">
          <h1>Settings</h1>
          <p>Core application details styled to match the rest of the Preferred Maintenance app family.</p>
        </div>

        <div className="max-w-2xl">
          <div className="card surface-panel mb-6">
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

          <div className="card surface-panel mb-6">
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

          <div className="card surface-panel">
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
