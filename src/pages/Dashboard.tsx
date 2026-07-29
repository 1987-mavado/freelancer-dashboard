import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../db/useSupabaseQuery'
import {
  kvasRepo,
  projekteRepo,
  rechnungenRepo,
  ausgabenRepo,
  deadlinesRepo,
  todosRepo,
  zeiteintraegeRepo,
} from '../db/repo'
import { addDaysISO, todayISO, formatEuro, formatDate } from '../utils/format'
import { tagesstunden, auslastungsStufe, montagDerWoche, formatDauer } from '../utils/zeiterfassung'
import { rechnungTotals } from '../utils/rechnung'
import LineChart from '../components/LineChart'
import CompactListWidget from '../components/CompactListWidget'
import { DocumentIcon, LetterIcon, FolderIcon, ClockIcon, CheckboxIcon } from '../components/icons'

// Montags-Daten (YYYY-MM-DD) der letzten `anzahl` Kalenderwochen inkl. der
// aktuellen, chronologisch aufsteigend — für den Finanz-Header-Trend.
function letzteWochenMontage(anzahl: number): string[] {
  const heuteMontag = montagDerWoche(todayISO())
  const result: string[] = []
  for (let i = anzahl - 1; i >= 0; i--) {
    const d = new Date(`${heuteMontag}T00:00:00`)
    d.setDate(d.getDate() - i * 7)
    result.push(d.toISOString().slice(0, 10))
  }
  return result
}

export default function Dashboard() {
  const kvas = useSupabaseQuery(['kvas'], () => kvasRepo.list(), [])
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])
  const ausgaben = useSupabaseQuery(['ausgaben'], () => ausgabenRepo.list(), [])
  const deadlines = useSupabaseQuery(['deadlines'], () => deadlinesRepo.list(), [])
  const todos = useSupabaseQuery(['todos'], () => todosRepo.list(), [])
  const zeiteintraege = useSupabaseQuery(['zeiteintraege'], () => zeiteintraegeRepo.list(), [])

  // Erinnerungen (bleiben als bedingte Hinweis-Banner bestehen — nur die
  // separate große Deadline-Sektion ist entfallen, siehe globaler Header).
  const heuteStunden = tagesstunden(zeiteintraege ?? [])
  const stufe = auslastungsStufe(heuteStunden)
  const today = todayISO()
  const rechnungenUeberfaellig = (rechnungen ?? []).filter(
    (r) => r.zahlungsstatus !== 'bezahlt' && r.faelligkeitsdatum < today,
  ).length
  const schwelle = addDaysISO(-7)
  const todosAlt = (todos ?? []).filter((t) => !t.erledigt && t.erstelltAm.slice(0, 10) < schwelle).length

  // Finanz-Header: Einnahmen (bezahlte Rechnungen) minus Ausgaben der
  // letzten 30 Tage. Approximation über das Rechnungs-Erstelldatum, da kein
  // separates Zahlungsdatum erfasst wird.
  const vor30Tage = addDaysISO(-30)
  const einnahmen30 = (rechnungen ?? [])
    .filter((r) => r.zahlungsstatus === 'bezahlt' && r.erstelltAm.slice(0, 10) >= vor30Tage)
    .reduce((sum, r) => sum + rechnungTotals(r.positionen, r.ustSatz).brutto, 0)
  const ausgaben30 = (ausgaben ?? []).filter((a) => a.datum >= vor30Tage).reduce((sum, a) => sum + a.betrag, 0)
  const netto30 = einnahmen30 - ausgaben30

  const nettoProWoche = letzteWochenMontage(8).map((montag) => {
    const sonntagDate = new Date(`${montag}T00:00:00`)
    sonntagDate.setDate(sonntagDate.getDate() + 6)
    const sonntag = sonntagDate.toISOString().slice(0, 10)
    const einnahmen = (rechnungen ?? [])
      .filter((r) => r.zahlungsstatus === 'bezahlt' && r.erstelltAm.slice(0, 10) >= montag && r.erstelltAm.slice(0, 10) <= sonntag)
      .reduce((sum, r) => sum + rechnungTotals(r.positionen, r.ustSatz).brutto, 0)
    const ausg = (ausgaben ?? []).filter((a) => a.datum >= montag && a.datum <= sonntag).reduce((sum, a) => sum + a.betrag, 0)
    return einnahmen - ausg
  })

  // Widget-Daten
  const offeneKvas = (kvas ?? []).filter((k) => k.status !== 'angenommen' && k.status !== 'abgelehnt')
  const offeneRechnungen = (rechnungen ?? []).filter((r) => r.zahlungsstatus !== 'bezahlt')
  const aktiveProjekte = (projekte ?? []).filter((p) => p.status === 'aktiv')
  const projektDeadlineById = new Map(
    (deadlines ?? [])
      .filter((d) => d.bezugTyp === 'projekt' && !d.erledigt)
      .map((d) => [d.bezugId, d.faelligkeitsdatum]),
  )
  const zeitHeute = (zeiteintraege ?? []).filter((z) => z.datum === today && !z.laeuft)
  const offeneTodos = (todos ?? []).filter((t) => !t.erledigt)

  function projektName(id: number) {
    return projekte?.find((p) => p.id === id)?.name ?? '–'
  }

  const kvaStatusLabel: Record<string, string> = { entwurf: 'Entwurf', gesendet: 'Gesendet', abgelehnt: 'Abgelehnt' }

  return (
    <div>
      <h1 style={{ marginTop: 'var(--s2)' }}>Übersicht</h1>

      <div className="card finance-header">
        <div className="finance-header-main">
          <div className="finance-value">{formatEuro(netto30)}</div>
          <div className="finance-chart">
            <LineChart values={nettoProWoche} color="var(--green)" />
          </div>
        </div>
        <div className="finance-substats">
          <div className="finance-substat red">
            <div className="finance-substat-value">{formatEuro(ausgaben30)}</div>
            <div className="finance-substat-label">Ausgaben (30 Tage)</div>
          </div>
          <div className="finance-substat green">
            <div className="finance-substat-value">{formatEuro(einnahmen30)}</div>
            <div className="finance-substat-label">Einnahmen (30 Tage)</div>
          </div>
        </div>
      </div>

      {stufe !== 'normal' && (
        <Link to="/zeit" className={`warn-banner ${stufe === 'rot' ? 'bad' : 'yellow'}`}>
          <div className="warn-title">
            {stufe === 'rot' ? '🔴 Stark überlastet heute' : '🟡 Hohe Auslastung heute'}
          </div>
          <div>{heuteStunden.toFixed(1).replace('.', ',')} Std. heute über alle Kunden/Projekte erfasst.</div>
        </Link>
      )}
      {rechnungenUeberfaellig > 0 && (
        <Link to="/rechnungen" className="warn-banner">
          <div className="warn-title">
            💸 {rechnungenUeberfaellig} Rechnung{rechnungenUeberfaellig > 1 ? 'en' : ''} überfällig
          </div>
          <div>Fälligkeitsdatum bereits verstrichen, noch nicht als bezahlt markiert.</div>
        </Link>
      )}
      {todosAlt > 0 && (
        <Link to="/fokus" className="warn-banner">
          <div className="warn-title">
            📝 {todosAlt} To-Do{todosAlt > 1 ? 's' : ''} seit über einer Woche offen
          </div>
          <div>Diese Einträge stehen schon länger unerledigt in deiner Liste.</div>
        </Link>
      )}

      <CompactListWidget
        icon={<DocumentIcon />}
        title="KVAs offen"
        count={offeneKvas.length}
        to="/kva"
        items={offeneKvas}
        getKey={(k) => k.id!}
        emptyText="Keine offenen KVAs."
        renderItem={(k) => (
          <>
            <span>{k.bezeichnung || 'Ohne Titel'}</span>
            <span className="widget-row-sub">{kvaStatusLabel[k.status] ?? k.status}</span>
          </>
        )}
      />

      <CompactListWidget
        icon={<LetterIcon />}
        title="Rechnungen offen"
        count={offeneRechnungen.length}
        to="/rechnungen"
        items={offeneRechnungen}
        getKey={(r) => r.id!}
        emptyText="Keine offenen Rechnungen."
        renderItem={(r) => {
          const { brutto } = rechnungTotals(r.positionen, r.ustSatz)
          return (
            <>
              <span>{r.rechnungsnummer}</span>
              <span className="widget-row-sub">{formatEuro(brutto)}</span>
            </>
          )
        }}
      />

      <CompactListWidget
        icon={<FolderIcon />}
        title="Aktive Projekte"
        count={aktiveProjekte.length}
        to="/projekte"
        items={aktiveProjekte}
        getKey={(p) => p.id!}
        emptyText="Keine aktiven Projekte."
        renderItem={(p) => {
          const deadline = projektDeadlineById.get(p.id!)
          return (
            <>
              <span>{p.name}</span>
              <span className="widget-row-sub">{deadline ? `bis ${formatDate(deadline)}` : p.nummer}</span>
            </>
          )
        }}
      />

      <CompactListWidget
        icon={<ClockIcon />}
        title="Zeiterfassung heute"
        count={zeitHeute.length}
        to="/zeit"
        items={zeitHeute}
        getKey={(z) => z.id!}
        emptyText="Noch keine Zeit heute erfasst."
        renderItem={(z) => (
          <>
            <span>
              {projektName(z.projektId)} · {z.rolle}
            </span>
            <span className="widget-row-sub">{formatDauer(z.dauerMinuten)}</span>
          </>
        )}
      />

      <CompactListWidget
        icon={<CheckboxIcon />}
        title="Fokus & To-Do"
        count={offeneTodos.length}
        to="/fokus"
        items={offeneTodos}
        getKey={(t) => t.id!}
        emptyText="Keine offenen Aufgaben."
        renderItem={(t) => (
          <>
            <span>{t.text}</span>
            <span className="widget-row-sub">{t.geschaetzteMinuten ? `${t.geschaetzteMinuten} Min.` : ''}</span>
          </>
        )}
      />
    </div>
  )
}
