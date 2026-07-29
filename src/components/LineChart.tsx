// Einfaches Linien-Chart, rein per SVG-Polyline — konsistent mit dem
// bestehenden CSS-only-Bar-Chart-Ansatz der App (kein externes Chart-Paket).
interface Props {
  values: number[]
  color?: string
  height?: number
}

export default function LineChart({ values, color = 'var(--green)', height = 56 }: Props) {
  if (values.length === 0) return null
  const width = 200
  const min = Math.min(0, ...values)
  const max = Math.max(1, ...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * width : width / 2
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
