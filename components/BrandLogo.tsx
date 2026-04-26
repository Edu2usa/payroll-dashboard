type BrandLogoProps = {
  subtitle?: string
  compact?: boolean
}

export function BrandLogo({ subtitle = 'Payroll Dashboard', compact = false }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <img
        src="/preferred-maintenance-logo.png"
        alt="Preferred Maintenance"
        className={compact ? 'h-10 w-auto object-contain' : 'h-12 w-auto object-contain'}
      />
      <div className="min-w-0">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/60">
          Preferred Maintenance
        </p>
        <p className="font-display text-lg font-bold text-white">{subtitle}</p>
      </div>
    </div>
  )
}
