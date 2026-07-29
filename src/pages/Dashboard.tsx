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
import { tagesstunden, auslastungsStufe } from '../utils/zeiterfassung'

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
  // Auslastungs-Warner: Summe aller Stunden über alle Kunden/Projekte am
  // heutigen Tag. 8 Std. = normal, über 10 Std. = Gelb, über 12 Std. = Rot.
  const heuteStunden = useSupabaseQuery(
    ['zeiteintraege'],
    async () => tagesstunden(await zeiteintraegeRepo.list()),
    [],
  )
  const stufe = auslastungsStufe(heuteStunden ?? 0)

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
    { to: '/ausgaben', label: 'Ausgaben', value: '🧾' },
    { to: '/ressourcen', label: 'Ressourcenplanung', value: '🛠' },
  ]

  return (
    <div>
      <h1 style={{ marginTop: 'var(--s2)' }}>Übersicht</h1>
      <p className="muted" style={{ marginBottom: 'var(--s5)' }}>
        {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
      </p>
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
      <div className="tile-grid">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to} className="tile">
            <span className="tile-value">{t.value ?? '–'}</span>
            <span className="tile-label">{t.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
