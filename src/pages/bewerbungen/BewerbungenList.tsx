import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { bewerbungenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import type { BewerbungStatus } from '../../db/types'

const statusBadgeClass: Record<BewerbungStatus, string> = {
  anschreiben_raus: 'orange',
  call: 'yellow',
  zusage: 'green',
}

const statusLabel: Record<BewerbungStatus, string> = {
  anschreiben_raus: 'Anschreiben raus',
  call: 'Call/Gespräch',
  zusage: 'Zusage',
}

export default function BewerbungenList() {
  const navigate = useNavigate()
  const [showArchiv, setShowArchiv] = useState(false)
  const bewerbungen = useSupabaseQuery(
    ['bewerbungen'],
    async () => (await bewerbungenRepo.list()).filter((b) => b.archiviert === showArchiv),
    [showArchiv],
  )

  async function handleDelete(e: React.MouseEvent, id?: number) {
    e.stopPropagation()
    if (!id) return
    if (!confirm('Bewerbung wirklich löschen?')) return
    await bewerbungenRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="Bewerbungen" />
      <div className="tab-bar">
        <button className={!showArchiv ? 'active' : ''} onClick={() => setShowArchiv(false)}>
          Aktiv
        </button>
        <button className={showArchiv ? 'active' : ''} onClick={() => setShowArchiv(true)}>
          Archiviert
        </button>
      </div>
      <div className="list">
        {bewerbungen?.map((b) => (
          <div key={b.id} className="list-item" onClick={() => navigate(`/bewerbungen/${b.id}`)}>
            <div>
              <div className="list-title">{b.firma}</div>
              <div className="list-sub">{b.rolle}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
              <span className={`status-badge ${statusBadgeClass[b.status]}`}>{statusLabel[b.status]}</span>
              <button className="icon-btn" onClick={(e) => handleDelete(e, b.id)} aria-label="Löschen">
                ✕
              </button>
            </div>
          </div>
        ))}
        {bewerbungen?.length === 0 && (
          <div className="empty">{showArchiv ? 'Keine archivierten Bewerbungen.' : 'Noch keine Bewerbungen.'}</div>
        )}
      </div>
      <Link to="/bewerbungen/neu" className="fab" aria-label="Bewerbung hinzufügen">
        +
      </Link>
    </div>
  )
}
