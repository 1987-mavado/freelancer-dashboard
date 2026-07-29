import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../db/supabaseClient'

// Ersetzt den bisherigen lokalen PIN-Lock durch Supabase Auth. Jeder Account
// hat über Row Level Security streng von anderen Accounts getrennte Daten
// (siehe Migration 0012_multi_user.sql) — Registrierung ist daher offen,
// nicht mehr auf einen einzigen manuell angelegten Account beschränkt.
export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [signupInfo, setSignupInfo] = useState('')

  // Wenn der Nutzer auf den "Passwort vergessen"-Link aus der E-Mail klickt,
  // leitet Supabase mit einem Recovery-Token in der URL hierher zurück
  // (z. B. #access_token=...&type=recovery). Der Client verarbeitet das
  // zwar automatisch und feuert intern das Event 'PASSWORD_RECOVERY', aber
  // das passiert oft schon, bevor React überhaupt gemountet und den
  // Listener registriert hat (Supabase liest die URL bereits beim Erzeugen
  // des Clients in supabaseClient.ts, also noch vor dem ersten Render) —
  // dann kommt das Event nie bei uns an. Deshalb prüfen wir zusätzlich
  // direkt und synchron beim allerersten Render, ob "type=recovery" in der
  // URL steht, statt uns allein auf das Event zu verlassen.
  const [recovery, setRecovery] = useState(
    () => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'),
  )
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

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSignupInfo('')
    if (password.length < 6) {
      setError('Das Passwort muss mindestens 6 Zeichen lang sein.')
      return
    }
    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    setSubmitting(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    if (!data.session) {
      setSignupInfo('Fast fertig — bitte den Bestätigungslink in deiner E-Mail-Inbox anklicken.')
      setMode('login')
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
        <h1>Done</h1>
        {recoveryDone && <p className="muted">Passwort gespeichert. Bitte jetzt anmelden.</p>}
        {signupInfo && <p className="muted">{signupInfo}</p>}
        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="stack">
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
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting
              ? mode === 'login'
                ? 'Anmelden…'
                : 'Registrieren…'
              : mode === 'login'
                ? 'Anmelden'
                : 'Account erstellen'}
          </button>
        </form>
        <button
          className="btn ghost full"
          style={{ marginTop: 'var(--s3)' }}
          onClick={() => {
            setMode((m) => (m === 'login' ? 'signup' : 'login'))
            setError('')
            setSignupInfo('')
          }}
        >
          {mode === 'login' ? 'Noch keinen Account? Registrieren' : 'Schon einen Account? Anmelden'}
        </button>
      </div>
    </div>
  )
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}
