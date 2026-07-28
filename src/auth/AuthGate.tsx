import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../db/supabaseClient'

// Ersetzt den bisherigen lokalen PIN-Lock durch Supabase Auth. Es gibt genau
// einen manuell angelegten Account (Self-Signup ist im Supabase-Projekt
// deaktiviert, siehe SUPABASE_SETUP.md) — daher nur ein Login-Formular,
// keine Registrierung.
export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Wenn der Nutzer auf den "Passwort vergessen"-Link aus der E-Mail klickt,
  // leitet Supabase mit einem Recovery-Token in der URL hierher zurück. Der
  // Client erkennt das automatisch und feuert das Event 'PASSWORD_RECOVERY'
  // (inkl. einer bereits gültigen Session). Ohne diesen Zustand würde der
  // Nutzer einfach den normalen Login-Bildschirm sehen und könnte nie ein
  // neues Passwort setzen.
  const [recovery, setRecovery] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [recoverySubmitting, setRecoverySubmitting] = useState(false)
  const [recoveryDone, setRecoveryDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signInError) {
      setError('E-Mail oder Passwort falsch.')
    }
  }

  async function handleSetNewPassword(e: FormEvent) {
    e.preventDefault()
    setRecoveryError('')
    if (newPassword.length < 6) {
      setRecoveryError('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }
    if (newPassword !== newPassword2) {
      setRecoveryError('Die beiden Passwörter stimmen nicht überein.')
      return
    }
    setRecoverySubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setRecoverySubmitting(false)
    if (updateError) {
      setRecoveryError('Passwort konnte nicht gespeichert werden: ' + updateError.message)
      return
    }
    setRecoveryDone(true)
    setRecovery(false)
  }

  // Sessionstatus wird asynchron geladen (undefined = noch unbekannt), damit
  // nicht kurz das Login-Formular aufblitzt, obwohl bereits eine gültige
  // Session im Local Storage liegt.
  if (session === undefined) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <p className="muted">Lade…</p>
        </div>
      </div>
    )
  }

  // Recovery-Modus hat Vorrang vor der normalen Session-Prüfung: Supabase
  // setzt beim Klick auf den E-Mail-Link zwar bereits eine gültige Session,
  // trotzdem soll der Nutzer erst ein neues Passwort vergeben, bevor er in
  // die App gelangt.
  if (recovery) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <h1>Neues Passwort vergeben</h1>
          <form onSubmit={handleSetNewPassword} className="stack">
            <input
              className="field"
              type="password"
              placeholder="Neues Passwort"
              autoFocus
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              className="field"
              type="password"
              placeholder="Neues Passwort wiederholen"
              autoComplete="new-password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
            />
            {recoveryError && <p className="error">{recoveryError}</p>}
            <button className="btn" type="submit" disabled={recoverySubmitting}>
              {recoverySubmitting ? 'Speichern…' : 'Passwort speichern'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (session) return <>{children}</>

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <h1>Freelance Dashboard</h1>
        {recoveryDone && <p className="muted">Passwort gespeichert. Bitte jetzt anmelden.</p>}
        <form onSubmit={handleLogin} className="stack">
          <input
            className="field"
            type="email"
            placeholder="E-Mail"
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="field"
            type="password"
            placeholder="Passwort"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
