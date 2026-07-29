import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { projekteRepo, kundenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import type { ProjektStatus } from '../../db/types'

const statusLabel: Record<ProjektStatus, string> = {
  akquise: 'Akquise',
  aktiv: 'Aktiv',
  pausiert: 'Pausiert',
  abgeschlossen: 'Abgeschlossen',
}

export default function ProjekteList() {
  const navigate = useNavigate()
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const kunden = useSupabaseQuery(['kunden'], () => kundenRepo.list(), [])

  function kundeName(kundeId: number) {
    return kunden?.find((k) => k.id === kundeId)?.name ?? '–'
  }

  async function handleDelete(e: React.MouseEvent, id?: number) {
    e.stopPropagation()
    if (!id) return
    if (!confirm('Projekt wirklich löschen? Verknüpfte KVAs und Rechnungen bleiben bestehen.')) return
    await projekteRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="Projekte" />
      <div className="list">
        {projekte?.map((p) => (
          <div key={p.id} className="list-item" onClick={() => navigate(`/projekte/${p.id}`)}>
            <div>
              <div className="list-title">{p.name}</div>
              <div className="list-sub">
                {kundeName(p.kundeId)} · {p.nummer}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
              <span className="status-pill">{statusLabel[p.status]}</span>
              <button className="icon-btn" onClick={(e) => handleDelete(e, p.id)} aria-label="Löschen">
                ✕
              </button>
            </div>
          </div>
        ))}
        {projekte?.length === 0 && <div className="empty">Noch keine Projekte angelegt.</div>}
      </div>
      <Link to="/projekte/neu" className="fab" aria-label="Projekt hinzufügen">
        +
      </Link>
    </div>
  )
}
