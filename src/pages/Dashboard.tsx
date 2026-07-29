import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../db/useSupabaseQuery'
import {
  bewerbungenRepo,
  projekteRepo,
  kvasRepo,
  rechnungenRepo,
  deadlinesRepo,
  todosRepo,
  getStammdaten,
  zeiteintraegeRepo,
} from '../db/repo'
import { addDaysISO, todayISO } from '../utils/format'
import { wochenstunden } from '../utils/zeiterfassung'

const NEU_OPTIONEN = [
  { to: '/kunden/neu', label: 'Kunde' },
  { to: '/agenturen/neu', label: 'Agentur' },
  { to: '/projekte/neu', label: 'Projekt' },
  { to: '/bewerbungen/neu', label: 'Bewerbung' },
  { to: '/kva/neu', label: 'KVA' },
  { to: '/rechnungen/neu', label: 'Rechnung' },
]

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false)
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
  const kvaCount = useSupabaseQuery(['kvas'], async () => (await kvasRepo.list()).length, [])
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
  const stammdaten = useSupabaseQuery(['stammdaten'], () => getStammdaten(), [])
  const wochenstundenErfasst = useSupabaseQuery(
    ['zeiteintraege'],
    async () => wochenstunden(await zeiteintraegeRepo.list()),
    [],
  )

  const kapazitaet = stammdaten?.wochenkapazitaetStunden ?? 0
  const ueberlastet = kapazitaet > 0 && (wochenstundenErfasst ?? 0) > kapazitaet

  const tiles = [
    { to: '/bewerbungen', label: 'Bewerbungen offen', value: bewerbungenOffen },
    { to: '/projekte', label: 'Aktive Projekte', value: projekteAktiv },
    { to: '/kva', label: 'KVAs offen', value: kvaCount },
    { to: '/rechnungen', label: 'Rechnungen offen', value: rechnungenOffen },
    { to: '/deadlines', label: 'Deadlines nächste 7 Tage', value: deadlinesBald },
    {
      to: '/stammdaten',
      label: 'Stammdaten',
      value: stammdaten?.name ? '✓' : '–',
    },
    { to: '/fokus', label: 'Fokus-Timer', value: '25/5' },
    { to: '/fokus', label: 'To-Do', value: todosOffen },
    { to: '/statistiken', label: 'Statistiken', value: '📊' },
  ]

  return (
    <div>
      <h1 style={{ marginTop: 'var(--s2)' }}>Übersicht</h1>
      <p className="muted" style={{ marginBottom: 'var(--s5)' }}>
        {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
      </p>
      {ueberlastet && (
        <Link to="/zeit" className="warn-banner">
          <div className="warn-title">⚠ Überlastet diese Woche</div>
          <div>
            {wochenstundenErfasst?.toFixed(1).replace('.', ',')} von {kapazitaet} Std. Wochenkapazität bereits
            erfasst.
          </div>
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
      <div className="tile-grid">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="tile">
            <span className="tile-value">{t.value ?? '–'}</span>
            <span className="tile-label">{t.label}</span>
          </Link>
        ))}
      </div>

      <button className="fab" onClick={() => setMenuOpen(true)} aria-label="Neu anlegen">
        +
      </button>

      {menuOpen && (
        <>
          <div className="action-sheet-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="action-sheet">
            {NEU_OPTIONEN.map((o) => (
              <Link key={o.to} to={o.to} onClick={() => setMenuOpen(false)}>
                {o.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
