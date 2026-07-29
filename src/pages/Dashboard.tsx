import { useState } from 'react'
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
  bewerbungenRepo,
} from '../db/repo'
import { addDaysISO, todayISO, formatEuro, formatDate } from '../utils/format'
import { tagesstunden, auslastungsStufe, formatDauer } from '../utils/zeiterfassung'
import { rechnungTotals } from '../utils/rechnung'
import { berechneFinanzen, nettoTrendWochen, nettoTrendMonateJahr } from '../utils/finanzen'
import LineChart from '../components/LineChart'
import CompactListWidget from '../components/CompactListWidget'
import { DocumentIcon, LetterIcon, FolderIcon, ClockIcon, CheckboxIcon, BriefcaseIcon } from '../components/icons'
import type { BewerbungStatus } from '../db/types'

const bewerbungStatusLabel: Record<BewerbungStatus, string> = {
  anschreiben_raus: 'Anschreiben raus',
  call: 'Call/Gespräch',
  zusage: 'Zusage',
}

type Zeitraum = 'monat' | 'jahr'

export default function Dashboard() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>('monat')
  const kvas = useSupabaseQuery(['kvas'], () => kvasRepo.list(), [])
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])
  const ausgaben = useSupabaseQuery(['ausgaben'], () => ausgabenRepo.list(), [])
  const deadlines = useSupabaseQuery(['deadlines'], () => deadlinesRepo.list(), [])
  const todos = useSupabaseQuery(['todos'], () => todosRepo.list(), [])
  const zeiteintraege = useSupabaseQuery(['zeiteintraege'], () => zeiteintraegeRepo.list(), [])
  const bewerbungen = useSupabaseQuery(['bewerbungen'], () => bewerbungenRepo.list(), [])

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

  // Finanz-Header: umschaltbar zwischen Monats- (letzte 30 Tage + 8-Wochen-
  // Trend) und Jahresansicht (laufendes Jahr + 12-Monats-Trend). Nutzt die
  // gemeinsame Berechnung aus utils/finanzen.ts, dieselbe wie im
  // Finanzen-Jahres-Header.
  const heuteJahr = new Date().getFullYear()
  const finanzenMonat = berechneFinanzen(rechnungen ?? [], ausgaben ?? [], addDaysISO(-30), today)
  const finanzenJahr = berechneFinanzen(rechnungen ?? [], ausgaben ?? [], `${heuteJahr}-01-01`, `${heuteJahr}-12-31`)
  const finanzenAktuell = zeitraum === 'monat' ? finanzenMonat : finanzenJahr
  const nettoTrend =
    zeitraum === 'monat'
      ? nettoTrendWochen(rechnungen ?? [], ausgaben ?? [], 8)
      : nettoTrendMonateJahr(rechnungen ?? [], ausgaben ?? [], heuteJahr)

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
  const offeneBewerbungen = (bewerbungen ?? []).filter((b) => !b.archiviert)

  function projektName(id: number) {
    return projekte?.find((p) => p.id === id)?.name ?? '–'
  }

  const kvaStatusLabel: Record<string, string> = { entwurf: 'Entwurf', gesendet: 'Gesendet', abgelehnt: 'Abgelehnt' }

  return (
    <div>
      <h1 style={{ marginTop: 'var(--s2)' }}>Übersicht</h1>

      <div className="card finance-header">
        <div className="finance-header-top">
          <span className="finance-header-label">
            {zeitraum === 'monat' ? 'Letzte 30 Tage' : `Jahr ${heuteJahr}`}
          </span>
          <div className="finance-toggle">
            <button className={zeitraum === 'monat' ? 'active' : ''} onClick={() => setZeitraum('monat')}>
              Monat
            </button>
            <button className={zeitraum === 'jahr' ? 'active' : ''} onClick={() => setZeitraum('jahr')}>
              Jahr
            </button>
          </div>
        </div>
        <div className="finance-header-main">
          <div className="finance-value">{formatEuro(finanzenAktuell.netto)}</div>
          <div className="finance-chart">
            <LineChart values={nettoTrend} color="var(--green)" />
          </div>
        </div>
        <div className="finance-substats">
          <div className="finance-substat red">
            <div className="finance-substat-value">{formatEuro(finanzenAktuell.ausgaben)}</div>
            <div className="finance-substat-label">Ausgaben ({zeitraum === 'monat' ? '30 Tage' : 'Jahr'})</div>
          </div>
          <div className="finance-substat green">
            <div className="finance-substat-value">{formatEuro(finanzenAktuell.einnahmen)}</div>
            <div className="finance-substat-label">Einnahmen ({zeitraum === 'monat' ? '30 Tage' : 'Jahr'})</div>
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
        to="/daily-doing?tab=projekte"
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
        to="/daily-doing?tab=zeit"
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
        to="/daily-doing?tab=fokus"
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

      <CompactListWidget
        icon={<BriefcaseIcon />}
        title="Bewerbungen"
        count={offeneBewerbungen.length}
        to="/bewerbungen"
        items={offeneBewerbungen}
        getKey={(b) => b.id!}
        emptyText="Keine offenen Bewerbungen."
        renderItem={(b) => (
          <>
            <span>{b.firma}</span>
            <span className="widget-row-sub">{bewerbungStatusLabel[b.status]}</span>
          </>
        )}
      />
    </div>
  )
}
