import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { rechnungenRepo, ausgabenRepo, kvasRepo } from '../../db/repo'
import { rechnungTotals } from '../../utils/rechnung'
import { formatEuro } from '../../utils/format'
import PageHeader from '../../layout/PageHeader'

// Bündelt die "Betrachten/Bearbeiten bestehender Einträge"-Seiten (im
// Unterschied zum zentralen "+", das dem Anlegen neuer Einträge dient).
export default function FinanzenPage() {
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])
  const ausgaben = useSupabaseQuery(['ausgaben'], () => ausgabenRepo.list(), [])
  const kvas = useSupabaseQuery(['kvas'], () => kvasRepo.list(), [])

  const offenePosten = (rechnungen ?? [])
    .filter((r) => r.zahlungsstatus !== 'bezahlt')
    .reduce((sum, r) => sum + rechnungTotals(r.positionen, r.ustSatz).brutto, 0)

  const ausgabenGesamt = (ausgaben ?? []).reduce((sum, a) => sum + a.betrag, 0)

  return (
    <div>
      <PageHeader title="Finanzen" back={false} />

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-value">{formatEuro(offenePosten)}</div>
          <div className="kpi-label">Offene Posten</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{formatEuro(ausgabenGesamt)}</div>
          <div className="kpi-label">Ausgaben gesamt</div>
        </div>
      </div>

      <div className="section-title">Übersicht</div>
      <div className="list">
        <Link to="/rechnungen" className="list-item">
          <div>
            <div className="list-title">Rechnungen</div>
            <div className="list-sub">{rechnungen?.length ?? 0} Einträge</div>
          </div>
          <span className="muted">›</span>
        </Link>
        <Link to="/kva" className="list-item">
          <div>
            <div className="list-title">KVAs</div>
            <div className="list-sub">{kvas?.length ?? 0} Einträge</div>
          </div>
          <span className="muted">›</span>
        </Link>
        <Link to="/ausgaben" className="list-item">
          <div>
            <div className="list-title">Ausgaben</div>
            <div className="list-sub">{ausgaben?.length ?? 0} Einträge</div>
          </div>
          <span className="muted">›</span>
        </Link>
        <Link to="/statistiken" className="list-item">
          <div>
            <div className="list-title">Statistiken</div>
            <div className="list-sub">Umsatz, Auslastung, Bewerbungserfolg</div>
          </div>
          <span className="muted">›</span>
        </Link>
      </div>
    </div>
  )
}
