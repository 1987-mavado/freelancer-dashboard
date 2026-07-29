import { useState } from 'react'
import { NavLink, Link, Outlet } from 'react-router-dom'
import { signOut } from '../auth/AuthGate'
import TimerWidget from '../timer/TimerWidget'

// Zentraler "+"-Button: öffnet die Verwaltungsebene (Anlegen neuer Einträge),
// von jeder Seite aus erreichbar — im Unterschied zu "Finanzen", das
// bestehende Einträge zum Betrachten/Bearbeiten zeigt.
const VERWALTUNG_OPTIONEN = [
  { to: '/agenturen/neu', label: 'Agentur & Ratecard' },
  { to: '/kunden/neu', label: 'Kunde' },
  { to: '/projekte/neu', label: 'Projekt' },
  { to: '/jahresuebersicht', label: 'Jahresübersicht (Steuer)' },
  { to: '/kva/neu', label: 'KVA' },
]

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    if (confirm('Abmelden?')) {
      await signOut()
    }
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        <button type="button" className="logout-btn" onClick={handleLogout} aria-label="Abmelden">
          ⏻
        </button>
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
