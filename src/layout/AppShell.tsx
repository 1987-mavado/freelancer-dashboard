import { useState } from 'react'
import { NavLink, Link, Outlet } from 'react-router-dom'
import { signOut } from '../auth/AuthGate'
import { useSupabaseQuery } from '../db/useSupabaseQuery'
import { deadlinesRepo } from '../db/repo'
import { addDaysISO } from '../utils/format'
import { ClockIcon } from '../components/icons'
import FokusmusikHeaderToggle from '../components/FokusmusikHeaderToggle'
import TimerWidget from '../timer/TimerWidget'

// Zentraler "+"-Button: öffnet die Verwaltungsebene (Anlegen neuer Einträge),
// von jeder Seite aus erreichbar — im Unterschied zu "Finanzen", das
// bestehende Einträge zum Betrachten/Bearbeiten zeigt.
const VERWALTUNG_OPTIONEN = [
  { to: '/agenturen/neu', label: 'Agentur & Ratecard' },
  { to: '/kunden/neu', label: 'Kunde' },
  { to: '/projekte/neu', label: 'Projekt' },
  { to: '/bewerbungen/neu', label: 'Bewerbung' },
  { to: '/jahresuebersicht', label: 'Jahresübersicht (Steuer)' },
  { to: '/kva/neu', label: 'KVA' },
]

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)

  // Ersetzt die frühere große Deadline-Sektion auf dem Homescreen: kleines
  // Uhr-Icon mit Warner-Badge (anstehende/überfällige, nicht erledigte
  // Deadlines) global im Header, auf jeder Seite sichtbar.
  const deadlinesCount = useSupabaseQuery(
    ['deadlines'],
    async () => {
      const in7 = addDaysISO(7)
      return (await deadlinesRepo.list()).filter((d) => !d.erledigt && d.faelligkeitsdatum <= in7).length
    },
    [],
  )

  async function handleLogout() {
    if (confirm('Abmelden?')) {
      await signOut()
    }
  }

  return (
    <div className="app-shell">
      <div className="global-header">
        <FokusmusikHeaderToggle />
        <Link to="/deadlines" className="header-icon-btn" aria-label="Deadlines">
          <ClockIcon />
          {!!deadlinesCount && deadlinesCount > 0 && <span className="header-badge">{deadlinesCount}</span>}
        </Link>
        <button type="button" className="header-icon-btn" onClick={handleLogout} aria-label="Abmelden">
          ⏻
        </button>
      </div>
      <div className="app-content">
        <Outlet />
      </div>
      <TimerWidget />

      {menuOpen && (
        <>
          <div className="action-sheet-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="action-sheet">
            {VERWALTUNG_OPTIONEN.map((o) => (
              <Link key={o.to} to={o.to} onClick={() => setMenuOpen(false)}>
                {o.label}
              </Link>
            ))}
          </div>
        </>
      )}

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">⌂</span>
          Übersicht
        </NavLink>
        <NavLink to="/projekte" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">▤</span>
          Projekte
        </NavLink>
        <div className="nav-plus-slot">
          <button type="button" className="nav-plus" onClick={() => setMenuOpen(true)} aria-label="Neu anlegen">
            +
          </button>
        </div>
        <NavLink to="/finanzen" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">€</span>
          Finanzen
        </NavLink>
        <NavLink to="/stammdaten" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">⚙</span>
          Einstellungen
        </NavLink>
      </nav>
    </div>
  )
}
