'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Building2, MapPin, Database, Key, LogOut } from 'lucide-react'

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
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex-1 lg:ml-64">
        <div className="p-4 sm:p-8 pt-16 lg:pt-8">

          <div className="page-header">
            <h1>Settings</h1>
            <p>Application configuration and account management</p>
          </div>

          <div className="max-w-2xl space-y-5">

            <div className="card">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Company</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                    <Building2 size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Company Name</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">Preferred Maintenance, LLC</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                    <MapPin size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Location</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">Connecticut</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Data & Security</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                    <Database size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Database</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">Supabase PostgreSQL</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                    <Key size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">API Authentication</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">X-API-Key Header</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Account</h2>
              <button
                onClick={handleLogout}
                className="btn btn-danger"
              >
                <LogOut size={15} />
                Sign Out
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
