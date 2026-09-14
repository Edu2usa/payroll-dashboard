'use client'
import Link from 'next/link'
import { Panel, Period, downloadCSV } from './PayrollWorkspace'
import { number, money } from '@/lib/payroll-domain'

export function PayrollSignals({ period }: { period: Period }) {
  if (!period.signals.length) return null
  return (
    <Panel
      title="Unusual payroll patterns"
      description="Changes that stand out against recent payrolls. Select a source to understand why."
      action={
        <button
          onClick={() =>
            downloadCSV('payroll-patterns.csv', [
              [
                'Category',
                'Current hours',
                'Previous hours',
                'Baseline hours',
                'Baseline payrolls',
                'Current earnings',
                'Earnings change',
              ],
              ...period.signals.map((s) => [
                s.category,
                s.current,
                s.previous,
                s.baseline,
                s.baseline_count,
                s.earnings,
                s.earnings_change,
              ]),
            ])
          }
        >
          Export CSV
        </button>
      }
    >
      {period.signals.map((signal) => (
        <div className="pw-signal" key={signal.category}>
          <div className="pw-signal-heading">
            <h3>{signal.title}</h3>
            <span className="pw-badge medium">Discrepancy worth checking</span>
          </div>
          <p>{signal.explanation}</p>
          <div className="pw-signal-values">
            <div>
              <span className="pw-label">This payroll</span>
              <strong>{number(signal.current)} h</strong>
            </div>
            <div>
              <span className="pw-label">Previous comparable payroll</span>
              <strong>{number(signal.previous)} h</strong>
            </div>
            <div>
              <span className="pw-label">
                {signal.baseline_count >= 3
                  ? `Median · ${signal.baseline_count} preceding payrolls`
                  : 'Previous payroll baseline'}
              </span>
              <strong>{number(signal.baseline)} h</strong>
            </div>
            <div>
              <span className="pw-label">Pay change vs previous</span>
              <strong>
                {signal.earnings_change >= 0 ? '+' : ''}
                {money(signal.earnings_change)}
              </strong>
            </div>
          </div>
          <div className="pw-actions">
            <Link
              className="pw-button"
              href={`/source/${period.id}?category=${signal.category}`}
            >
              See contributors & source ↗
            </Link>
            <Link
              className="pw-button"
              href={`/source/${signal.previous_period_id}?category=${signal.category}`}
            >
              Previous source ↗
            </Link>
            <Link className="pw-button" href="/comparison">
              Explain the cost change →
            </Link>
          </div>
        </div>
      ))}
    </Panel>
  )
}
