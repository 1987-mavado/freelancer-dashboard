import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const MAX_SICHTBAR = 4

interface Props<T> {
  icon: ReactNode
  title: string
  count: number
  to: string
  items: T[]
  getKey: (item: T) => string | number
  renderItem: (item: T) => ReactNode
  emptyText: string
}

// Kompaktes Homescreen-Widget: Icon + Titel + Gesamtzahl im Kopf, bis zu 4
// Zeilen sichtbar, mit Fade-Out am unteren Rand als Hinweis auf weitere
// Einträge, sobald mehr als 4 vorhanden sind. Das ganze Widget verlinkt auf
// die zugehörige Liste (Detailseite).
export default function CompactListWidget<T>({
  icon,
  title,
  count,
  to,
  items,
  getKey,
  renderItem,
  emptyText,
}: Props<T>) {
  const sichtbar = items.slice(0, MAX_SICHTBAR)
  const abgeschnitten = items.length > MAX_SICHTBAR

  return (
    <Link to={to} className="widget-card">
      <div className="widget-header">
        <span className="widget-icon">{icon}</span>
        <span className="widget-title">{title}</span>
        <span className="widget-count">{count}</span>
      </div>
      <div className={`widget-list${abgeschnitten ? ' widget-list-fade' : ''}`}>
        {sichtbar.map((item) => (
          <div key={getKey(item)} className="widget-row">
            {renderItem(item)}
          </div>
        ))}
        {items.length === 0 && <div className="widget-empty">{emptyText}</div>}
      </div>
    </Link>
  )
}
