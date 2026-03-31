'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Upload, Users, TrendingUp, Clock, Settings, LogOut } from 'lucide-react'

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

  const handleLogout = () => {
    document.cookie = 'payroll_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
  }

  return (
    <div className="w-64 bg-gradient-to-b from-slate-900 to-slate-800 text-white min-h-screen fixed left-0 top-0 shadow-xl">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold">Payroll</h1>
        <p className="text-slate-400 text-sm mt-1">Dashboard</p>
      </div>

      <nav className="flex-1 px-4 py-8">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <Link
          href="/"
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors w-full"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </Link>
      </div>
    </div>
  )
}
