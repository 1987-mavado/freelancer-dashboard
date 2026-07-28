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
