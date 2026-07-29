import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { projekteRepo, kundenRepo } from '../../db/repo'
import { ensureRechnungFuerAbgeschlossenesProjekt } from '../../utils/rechnung'
import PageHeader from '../../layout/PageHeader'
import type { ProjektStatus } from '../../db/types'

const statusLabel: Record<ProjektStatus, string> = {
  akquise: 'Akquise',
  aktiv: 'Aktiv',
  pausiert: 'Pausiert',
  abgeschlossen: 'Abgeschlossen',
}

const statusBadgeClass: Record<ProjektStatus, string> = {
  akquise: 'neutral',
  aktiv: 'orange',
  pausiert: 'yellow',
  abgeschlossen: 'green',
}

export default function ProjekteList() {
  const navigate = useNavigate()
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const kunden = useSupabaseQuery(['kunden'], () => kundenRepo.list(), [])

  function kundeName(kundeId: number) {
    return kunden?.find((k) => k.id === kundeId)?.name ?? '–'
  }

  async function handleAbschliessen(e: React.MouseEvent, id?: number) {
    e.stopPropagation()
    if (!id) return
    if (!confirm('Projekt abschließen? Dabei wird automatisch eine Rechnung angelegt.')) return
    await projekteRepo.update(id, { status: 'abgeschlossen' })
    const neueRechnungId = await ensureRechnungFuerAbgeschlossenesProjekt(id)
    if (neueRechnungId) navigate(`/rechnungen/${neueRechnungId}`)
  }

  async function handleDelete(e: React.MouseEvent, projekt: { id?: number; status: ProjektStatus }) {
    e.stopPropagation()
    if (!projekt.id) return
    const frage =
      projekt.status !== 'akquise'
        ? 'Dieses Projekt ist bereits aktiv/abgeschlossen — wirklich löschen? (Verknüpfte KVAs und Rechnungen bleiben bestehen.)'
        : 'Projekt wirklich löschen?'
    if (!confirm(frage)) return
    await projekteRepo.remove(projekt.id)
  }

  return (
    <div>
      <PageHeader title="Projekte" back={false} />
      <div className="list">
        {projekte?.map((p) => (
          <div key={p.id} className="list-item" onClick={() => navigate(`/projekte/${p.id}`)}>
            <div>
              <div className="list-title">{p.name}</div>
              <div className="list-sub">
                {kundeName(p.kundeId)} · {p.nummer}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
              <span className={`status-badge ${statusBadgeClass[p.status]}`}>{statusLabel[p.status]}</span>
              {p.status !== 'abgeschlossen' && (
                <button className="icon-btn" onClick={(e) => handleAbschliessen(e, p.id)} aria-label="Abschließen">
                  ✓
                </button>
              )}
              <button className="icon-btn" onClick={(e) => handleDelete(e, p)} aria-label="Löschen">
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
