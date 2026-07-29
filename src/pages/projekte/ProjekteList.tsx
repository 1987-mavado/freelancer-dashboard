import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { projekteRepo, kundenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import type { ProjektStatus } from '../../db/types'

const statusLabel: Record<ProjektStatus, string> = {
  akquise: 'Akquise',
  aktiv: 'Aktiv',
  ressourcenplanung: 'Ressourcenplanung',
  pausiert: 'Pausiert',
  abgeschlossen: 'Abgeschlossen',
}

export default function ProjekteList() {
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const kunden = useSupabaseQuery(['kunden'], () => kundenRepo.list(), [])

  function kundeName(kundeId: number) {
    return kunden?.find((k) => k.id === kundeId)?.name ?? '–'
  }

  return (
    <div>
      <PageHeader title="Projekte" />
      <div className="list">
        {projekte?.map((p) => (
          <Link key={p.id} to={`/projekte/${p.id}`} className="list-item">
            <div>
              <div className="list-title">{p.name}</div>
              <div className="list-sub">
                {kundeName(p.kundeId)} · {p.nummer}
              </div>
            </div>
            <span className="status-pill">{statusLabel[p.status]}</span>
          </Link>
        ))}
        {projekte?.length === 0 && <div className="empty">Noch keine Projekte angelegt.</div>}
      </div>
      <Link to="/projekte/neu" className="fab" aria-label="Projekt hinzufügen">
        +
      </Link>
    </div>
  )
}
