import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { rechnungenRepo, ausgabenRepo, kvasRepo } from '../../db/repo'
import { rechnungTotals } from '../../utils/rechnung'
import { berechneFinanzen, nettoTrendMonateJahr } from '../../utils/finanzen'
import { formatEuro } from '../../utils/format'
import LineChart from '../../components/LineChart'
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

  const jahr = new Date().getFullYear()
  const jahreswerte = berechneFinanzen(rechnungen ?? [], ausgaben ?? [], `${jahr}-01-01`, `${jahr}-12-31`)
  const nettoTrend = nettoTrendMonateJahr(rechnungen ?? [], ausgaben ?? [], jahr)

  return (
    <div>
      <PageHeader title="Finanzen" back={false} />

      <div className="card finance-header">
        <div className="finance-header-label">Jahresergebnis {jahr}</div>
        <div className="finance-header-main">
          <div className="finance-value">{formatEuro(jahreswerte.netto)}</div>
          <div className="finance-chart">
            <LineChart values={nettoTrend} color="var(--green)" />
          </div>
        </div>
        <div className="finance-substats">
          <div className="finance-substat red">
            <div className="finance-substat-value">{formatEuro(jahreswerte.ausgaben)}</div>
            <div className="finance-substat-label">Ausgaben (Jahr)</div>
          </div>
          <div className="finance-substat green">
            <div className="finance-substat-value">{formatEuro(jahreswerte.einnahmen)}</div>
            <div className="finance-substat-label">Einnahmen (Jahr)</div>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-value">{formatEuro(offenePosten)}</div>
          <div className="kpi-label">Offene Posten</div>
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
        <Link to="/jahresuebersicht" className="list-item">
          <div>
            <div className="list-title">Jahresübersicht (Steuer)</div>
            <div className="list-sub">Für den Steuerberater, mit Jahresauswahl</div>
          </div>
          <span className="muted">›</span>
        </Link>
      </div>
    </div>
  )
}
