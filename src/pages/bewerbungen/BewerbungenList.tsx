import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { bewerbungenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import type { BewerbungStatus } from '../../db/types'

const statusBadge: Record<BewerbungStatus, string> = {
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
  const [showArchiv, setShowArchiv] = useState(false)
  const bewerbungen = useSupabaseQuery(
    ['bewerbungen'],
    async () => (await bewerbungenRepo.list()).filter((b) => b.archiviert === showArchiv),
    [showArchiv],
  )

  return (
    <div>
      <PageHeader title="Bewerbungen" />
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <button className={`btn ${showArchiv ? 'ghost' : ''}`} onClick={() => setShowArchiv(false)}>
          Aktiv
        </button>
        <button className={`btn ${!showArchiv ? 'ghost' : ''}`} onClick={() => setShowArchiv(true)}>
          Archiviert
        </button>
      </div>
      <div className="list">
        {bewerbungen?.map((b) => (
          <Link key={b.id} to={`/bewerbungen/${b.id}`} className="list-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
              <span className={`badge ${statusBadge[b.status]}`} />
              <div>
                <div className="list-title">{b.firma}</div>
                <div className="list-sub">{b.rolle}</div>
              </div>
            </div>
            <span className="status-pill">{statusLabel[b.status]}</span>
          </Link>
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
