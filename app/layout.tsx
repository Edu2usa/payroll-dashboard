import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Payroll Dashboard - Preferred Maintenance',
  description: 'Payroll management and analysis dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
