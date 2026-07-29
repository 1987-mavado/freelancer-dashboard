// Kreisförmiger Fortschritts-/Prozent-Ring, rein per SVG (kein externes
// Icon-/Chart-Paket nötig) — z.B. für KVA-Status oder Rechnungs-Zahlstatus.
interface Props {
  percent: number
  color: string
  size?: number
  strokeWidth?: number
  label?: string
}

export default function PercentRing({ percent, color, size = 56, strokeWidth = 5, label }: Props) {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - clamped / 100)

  return (
    <div className="percent-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="percent-ring-value">{label ?? `${Math.round(clamped)}%`}</span>
    </div>
  )
}
