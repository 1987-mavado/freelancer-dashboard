import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { rechnungenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import { rechnungTotals } from '../../utils/rechnung'
import { formatEuro, formatDate } from '../../utils/format'
import type { Zahlungsstatus } from '../../db/types'

const statusColor: Record<Zahlungsstatus, string> = {
  offen: 'yellow',
  bezahlt: 'green',
  ueberfaellig: 'orange',
}

const statusLabel: Record<Zahlungsstatus, string> = {
  offen: 'Offen',
  bezahlt: 'Bezahlt',
  ueberfaellig: 'Überfällig',
}

export default function RechnungenList() {
  const navigate = useNavigate()
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])

  async function handleDelete(e: React.MouseEvent, id?: number) {
    e.stopPropagation()
    if (!id) return
    if (!confirm('Rechnung wirklich löschen?')) return
    await rechnungenRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="Rechnungen" />
      <div className="list">
        {rechnungen?.map((r) => {
          const { brutto } = rechnungTotals(r.positionen, r.ustSatz)
          return (
            <div key={r.id} className="list-item" onClick={() => navigate(`/rechnungen/${r.id}`)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                <span className={`badge ${statusColor[r.zahlungsstatus]}`} />
                <div>
                  <div className="list-title">{r.rechnungsnummer}</div>
                  <div className="list-sub">
                    {formatEuro(brutto)} · fällig {formatDate(r.faelligkeitsdatum)}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                <span className="status-pill">{statusLabel[r.zahlungsstatus]}</span>
                <button className="icon-btn" onClick={(e) => handleDelete(e, r.id)} aria-label="Löschen">
                  ✕
                </button>
              </div>
            </div>
          )
        })}
        {rechnungen?.length === 0 && <div className="empty">Noch keine Rechnungen angelegt.</div>}
      </div>
      <Link to="/rechnungen/neu" className="fab" aria-label="Rechnung hinzufügen">
        +
      </Link>
    </div>
  )
}
