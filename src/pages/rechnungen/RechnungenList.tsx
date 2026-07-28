import { Link } from 'react-router-dom'
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
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])

  return (
    <div>
      <PageHeader title="Rechnungen" />
      <div className="list">
        {rechnungen?.map((r) => {
          const { brutto } = rechnungTotals(r.positionen, r.ustSatz)
          return (
            <Link key={r.id} to={`/rechnungen/${r.id}`} className="list-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                <span className={`badge ${statusColor[r.zahlungsstatus]}`} />
                <div>
                  <div className="list-title">{r.rechnungsnummer}</div>
                  <div className="list-sub">
                    {formatEuro(brutto)} · fällig {formatDate(r.faelligkeitsdatum)}
                  </div>
                </div>
              </div>
              <span className="status-pill">{statusLabel[r.zahlungsstatus]}</span>
            </Link>
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
