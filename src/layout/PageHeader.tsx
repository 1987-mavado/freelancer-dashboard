import { useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

export default function PageHeader({
  title,
  back = true,
  action,
}: {
  title: string
  back?: boolean
  action?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="app-header" style={{ margin: 'calc(var(--s4) * -1) calc(var(--s4) * -1) var(--s4)' }}>
      {back && (
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Zurück">
          ‹
        </button>
      )}
      <h1>{title}</h1>
      {action}
    </header>
  )
}
