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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
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

  if (session) return <>{children}</>

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <h1>Freelance Dashboard</h1>
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
