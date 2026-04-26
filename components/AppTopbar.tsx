'use client'

import Link from 'next/link'
import { BrandLogo } from './BrandLogo'

type AppTopbarProps = {
  backHref: string
  backLabel: string
  subtitle?: string
}

export function AppTopbar({ backHref, backLabel, subtitle = 'Payroll Dashboard' }: AppTopbarProps) {
  return (
    <nav className="app-topbar">
      <div className="container app-topbar-inner">
        <Link href="/dashboard" className="brand-wordmark-link">
          <BrandLogo subtitle={subtitle} compact />
        </Link>
        <Link href={backHref} className="back-link">
          {backLabel}
        </Link>
      </div>
    </nav>
  )
}
