import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStammdaten } from '../../db/repo'
import { getCachedAccessToken } from '../../utils/googleCalendar/auth'
import { listEventsBetween, type CalendarEventSummary } from '../../utils/googleCalendar/api'
import { montagDerWoche } from '../../utils/zeiterfassung'
import { todayISO } from '../../utils/format'

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

function wochenTage(): string[] {
  const montag = montagDerWoche(todayISO())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${montag}T00:00:00`)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

// Wochenübersicht des verbundenen Google-Kalenders, damit Deadlines im
// Kontext der übrigen Termine sichtbar sind. Reiner Lesezugriff, löst wie
// GoogleCalendarWidget keinen eigenen OAuth-Flow aus — ist noch keine
// Verbindung vorhanden, gibt es stattdessen einen Hinweis mit Link zu den
// Einstellungen statt eines stillen Fehlschlags (hier ist der Kalender der
// eigentliche Zweck der Seite, nicht nur ein Zusatz-Widget).
export default function DeadlineWeekCalendar() {
  const [events, setEvents] = useState<CalendarEventSummary[] | null>(null)
  const [verbunden, setVerbunden] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stammdaten = await getStammdaten()
        if (!stammdaten.googleClientId.trim()) {
          if (!cancelled) setVerbunden(false)
          return
        }
        const token = getCachedAccessToken(stammdaten.googleClientId)
        if (!token) {
          if (!cancelled) setVerbunden(false)
          return
        }
        const tage = wochenTage()
        const timeMin = `${tage[0]}T00:00:00Z`
        const timeMax = `${tage[6]}T23:59:59Z`
        const items = await listEventsBetween(token, stammdaten.googleCalendarId || 'primary', timeMin, timeMax)
        if (!cancelled) {
          setEvents(items)
          setVerbunden(true)
        }
      } catch {
        if (!cancelled) setVerbunden(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const tage = wochenTage()

  return (
    <div>
      <div className="section-title">Kalenderwoche</div>
      {verbunden === false && (
        <p className="muted">
          Kein Google-Kalender verbunden.{' '}
          <Link to="/stammdaten">Unter Einstellungen verbinden</Link>, um Termine hier zu sehen.
        </p>
      )}
      {verbunden === null && <p className="muted">Lade Kalenderwoche…</p>}
      {verbunden && (
        <div className="stack">
          {tage.map((tag, i) => {
            const tagesEvents = (events ?? []).filter((e) => (e.start ?? '').slice(0, 10) === tag)
            return (
              <div key={tag} className="card">
                <div className="list-sub" style={{ marginBottom: 'var(--s2)' }}>
                  {WOCHENTAGE[i]}, {tag.slice(8, 10)}.{tag.slice(5, 7)}.
                </div>
                {tagesEvents.length === 0 && <div className="muted">Keine Termine</div>}
                {tagesEvents.map((e) => (
                  <div key={e.id} className="list-sub">
                    {e.allDay ? '' : `${new Date(e.start!).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · `}
                    {e.summary}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
