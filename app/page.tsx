'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        setError('Invalid password')
        setLoading(false)
        return
      }

      router.push('/dashboard')
    } catch (err) {
      setError('Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-heading via-brand-primary to-brand-secondary px-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-10 w-full max-w-md border border-slate-200">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg bg-brand-primary flex items-center justify-center mb-4">
            <span className="font-mono font-bold text-white text-lg">PM</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-1">Payroll Dashboard</h1>
          <p className="text-center text-sm text-slate-500 font-mono">Preferred Maintenance, LLC</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter password"
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-cta w-full"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
