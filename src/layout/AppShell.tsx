import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from '../auth/AuthGate'

export default function AppShell() {
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
      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">⌂</span>
          Start
        </NavLink>
        <NavLink to="/fokus" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">◷</span>
          Fokus
        </NavLink>
        <NavLink to="/deadlines" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">⚑</span>
          Deadlines
        </NavLink>
        <NavLink to="/stammdaten" className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="icon">⚙</span>
          Profil
        </NavLink>
      </nav>
    </div>
  )
}
