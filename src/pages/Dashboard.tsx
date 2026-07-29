import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../db/useSupabaseQuery'
import {
  bewerbungenRepo,
  projekteRepo,
  kvasRepo,
  rechnungenRepo,
  ausgabenRepo,
  deadlinesRepo,
  todosRepo,
  zeiteintraegeRepo,
} from '../db/repo'
import { addDaysISO, todayISO, formatEuro } from '../utils/format'
import { tagesstunden, auslastungsStufe, montagDerWoche } from '../utils/zeiterfassung'
import { rechnungTotals } from '../utils/rechnung'
import LineChart from '../components/LineChart'
import FokusmusikToggle from './fokus/FokusmusikToggle'
import type { KvaStatus } from '../db/types'

const kvaStatusLabel: Record<KvaStatus, string> = {
  entwurf: 'Entwurf',
  gesendet: 'Gesendet',
  angenommen: 'Angenommen',
  abgelehnt: 'Abgelehnt',
}

const kvaStatusBadgeClass: Record<KvaStatus, string> = {
  entwurf: 'neutral',
  gesendet: 'orange',
  angenommen: 'green',
  abgelehnt: 'red',
}

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
  const bewerbungenOffen = useSupabaseQuery(
    ['bewerbungen'],
    async () => (await bewerbungenRepo.list()).filter((b) => !b.archiviert).length,
    [],
  )
  const projekteAktiv = useSupabaseQuery(
    ['projekte'],
    async () => (await projekteRepo.list()).filter((p) => p.status === 'aktiv').length,
    [],
  )
  const kvaOffenCount = useSupabaseQuery(
    ['kvas'],
    async () => (await kvasRepo.list()).filter((k) => k.status !== 'angenommen' && k.status !== 'abgelehnt').length,
    [],
  )
  const offeneKvas = useSupabaseQuery(
    ['kvas'],
    async () => (await kvasRepo.list()).filter((k) => k.status !== 'angenommen' && k.status !== 'abgelehnt'),
    [],
  )
  const rechnungenOffen = useSupabaseQuery(
    ['rechnungen'],
    async () => (await rechnungenRepo.list()).filter((r) => r.zahlungsstatus !== 'bezahlt').length,
    [],
  )
  const deadlinesBald = useSupabaseQuery(['deadlines'], async () => {
    const today = todayISO()
    const in7 = addDaysISO(7)
    return (await deadlinesRepo.list()).filter(
      (d) => !d.erledigt && d.faelligkeitsdatum >= today && d.faelligkeitsdatum <= in7,
    ).length
  }, [])
  const todosOffen = useSupabaseQuery(
    ['todos'],
    async () => (await todosRepo.list()).filter((t) => !t.erledigt).length,
    [],
  )
  // Erinnerungen: überfällige Rechnungen (Fälligkeitsdatum bereits verstrichen,
  // noch nicht bezahlt) und schon länger (>7 Tage) unerledigte To-Dos.
  const rechnungenUeberfaellig = useSupabaseQuery(
    ['rechnungen'],
    async () => {
      const today = todayISO()
      return (await rechnungenRepo.list()).filter((r) => r.zahlungsstatus !== 'bezahlt' && r.faelligkeitsdatum < today)
        .length
    },
    [],
  )
  const todosAlt = useSupabaseQuery(
    ['todos'],
    async () => {
      const schwelle = addDaysISO(-7)
      return (await todosRepo.list()).filter((t) => !t.erledigt && t.erstelltAm.slice(0, 10) < schwelle).length
    },
    [],
  )
  // Auslastungs-Warner: Summe aller Stunden über alle Kunden/Projekte am
  // heutigen Tag. 8 Std. = normal, über 10 Std. = Gelb, über 12 Std. = Rot.
  const heuteStunden = useSupabaseQuery(
    ['zeiteintraege'],
    async () => tagesstunden(await zeiteintraegeRepo.list()),
    [],
  )
  const stufe = auslastungsStufe(heuteStunden ?? 0)

  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])
  const ausgaben = useSupabaseQuery(['ausgaben'], () => ausgabenRepo.list(), [])

  // Finanz-Header: Einnahmen (bezahlte Rechnungen) minus Ausgaben der letzten
  // 30 Tage. Approximation über das Rechnungs-Erstelldatum, da kein
  // separates Zahlungsdatum erfasst wird (wie an anderer Stelle bereits
  // kommuniziert).
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
    const ausg = (ausgaben ?? [])
      .filter((a) => a.datum >= montag && a.datum <= sonntag)
      .reduce((sum, a) => sum + a.betrag, 0)
    return einnahmen - ausg
  })

  // Steuer-Kachel: einfache Gewinn-Näherung fürs laufende Jahr (Details/
  // vollständige Aufschlüsselung unter Jahresübersicht).
  const jahr = new Date().getFullYear()
  const einnahmenJahr = (rechnungen ?? [])
    .filter((r) => r.zahlungsstatus === 'bezahlt' && r.erstelltAm.slice(0, 4) === String(jahr))
    .reduce((sum, r) => sum + rechnungTotals(r.positionen, r.ustSatz).netto, 0)
  const ausgabenJahr = (ausgaben ?? []).filter((a) => a.datum.slice(0, 4) === String(jahr)).reduce((sum, a) => sum + a.betrag, 0)
  const gewinnJahr = einnahmenJahr - ausgabenJahr

  const tiles = [
    { to: '/bewerbungen', label: 'Bewerbungen offen', value: bewerbungenOffen },
    { to: '/projekte', label: 'Aktive Projekte', value: projekteAktiv },
    { to: '/kva', label: 'KVAs offen', value: kvaOffenCount },
    { to: '/rechnungen', label: 'Rechnungen offen', value: rechnungenOffen },
    { to: '/deadlines', label: 'Deadlines nächste 7 Tage', value: deadlinesBald },
    { to: '/fokus', label: 'Fokus & To-Do', value: todosOffen },
    { to: '/zeit', label: 'Zeiterfassung heute', value: heuteStunden?.toFixed(1).replace('.', ',') ?? '–' },
    { to: '/statistiken', label: 'Statistiken', value: '📊' },
    { to: '/ausgaben', label: 'Ausgaben', value: '🧾' },
    { to: '/jahresuebersicht', label: 'Steuer (Gewinn ' + jahr + ')', value: formatEuro(gewinnJahr) },
  ]

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
          <div>{heuteStunden?.toFixed(1).replace('.', ',')} Std. heute über alle Kunden/Projekte erfasst.</div>
        </Link>
      )}
      {!!deadlinesBald && deadlinesBald > 0 && (
        <Link to="/deadlines" className="warn-banner">
          <div className="warn-title">
            ⏰ {deadlinesBald} Deadline{deadlinesBald > 1 ? 's' : ''} bald fällig
          </div>
          <div>In den nächsten 7 Tagen fällig und noch nicht erledigt.</div>
        </Link>
      )}
      {!!rechnungenUeberfaellig && rechnungenUeberfaellig > 0 && (
        <Link to="/rechnungen" className="warn-banner">
          <div className="warn-title">
            💸 {rechnungenUeberfaellig} Rechnung{rechnungenUeberfaellig > 1 ? 'en' : ''} überfällig
          </div>
          <div>Fälligkeitsdatum bereits verstrichen, noch nicht als bezahlt markiert.</div>
        </Link>
      )}
      {!!todosAlt && todosAlt > 0 && (
        <Link to="/fokus" className="warn-banner">
          <div className="warn-title">
            📝 {todosAlt} To-Do{todosAlt > 1 ? 's' : ''} seit über einer Woche offen
          </div>
          <div>Diese Einträge stehen schon länger unerledigt in deiner Liste.</div>
        </Link>
      )}

      {!!offeneKvas && offeneKvas.length > 0 && (
        <>
          <div className="section-title">Offene KVAs</div>
          <div className="list" style={{ marginBottom: 'var(--s4)' }}>
            {offeneKvas.map((k) => (
              <Link key={k.id} to={`/kva/${k.id}`} className="list-item">
                <div className="list-title">{k.bezeichnung}</div>
                <span className={`status-badge ${kvaStatusBadgeClass[k.status]}`}>{kvaStatusLabel[k.status]}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="tile-grid">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="tile">
            <span className="tile-value">{t.value ?? '–'}</span>
            <span className="tile-label">{t.label}</span>
          </Link>
        ))}
        <div className="tile fokusmusik">
          <FokusmusikToggle />
          <span className="tile-label">Fokusmusik</span>
        </div>
      </div>
    </div>
  )
}
