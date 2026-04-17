'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Upload, Users, TrendingUp, Clock, Settings, LogOut, Menu, X } from 'lucide-react'

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/upload', label: 'Upload PDF', icon: Upload },
  { href: '/employees', label: 'Employees', icon: Users },
  { href: '/comparison', label: 'Comparison', icon: TrendingUp },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
  }

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-brand-cta flex items-center justify-center">
            <span className="font-mono font-bold text-slate-900 text-sm">PM</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Payroll</h1>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">Dashboard</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 px-4 py-8">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-brand-primary text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-700/60">
        <Link
          href="/"
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-slate-300 hover:bg-slate-700/80 hover:text-white transition-colors duration-200 w-full cursor-pointer"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </Link>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-slate-900 text-white p-2 rounded-lg shadow-lg"
      >
        <Menu size={24} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar (slide in) */}
      <div className={`lg:hidden fixed left-0 top-0 w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white min-h-screen z-50 shadow-xl transform transition-transform duration-300 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </div>

      {/* Desktop sidebar (always visible) */}
      <div className="hidden lg:block w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white min-h-screen fixed left-0 top-0 shadow-xl">
        {sidebarContent}
      </div>
    </>
  )
}
