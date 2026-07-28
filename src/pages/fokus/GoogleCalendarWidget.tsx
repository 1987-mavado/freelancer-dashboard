import { useEffect, useState } from 'react'
import { getStammdaten } from '../../db/repo'
import { getCachedAccessToken } from '../../utils/googleCalendar/auth'
import { listUpcomingEvents, type CalendarEventSummary } from '../../utils/googleCalendar/api'
import { formatDate } from '../../utils/format'

// Reiner Lesezugriff: zeigt die nächsten Google-Kalender-Termine an, sofern
// bereits eine Verbindung besteht (Access-Token im Speicher, siehe
// getCachedAccessToken). Löst absichtlich KEINEN eigenen OAuth-Flow aus —
// das würde auf einer häufig besuchten Seite wie "Fokus" ein überraschendes
// Google-Consent-Popup bedeuten. Verbunden wird weiterhin nur über den
// bestehenden "Verbinden & synchronisieren"-Button in den Stammdaten; ist
// noch keine Verbindung/kein gültiger Token vorhanden, blendet sich das
// Widget einfach komplett aus.
export default function GoogleCalendarWidget() {
  const [events, setEvents] = useState<CalendarEventSummary[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const stammdaten = await getStammdaten()
        if (!stammdaten.googleClientId.trim()) return
        const token = getCachedAccessToken(stammdaten.googleClientId)
        if (!token) return
        const items = await listUpcomingEvents(token, stammdaten.googleCalendarId || 'primary')
        if (!cancelled) setEvents(items)
      } catch {
        // Stiller Fehlschlag — Widget bleibt einfach ausgeblendet.
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!events) return null

  return (
    <>
      <div className="section-title">Nächste Kalendertermine</div>
      <div className="list" style={{ marginBottom: 'var(--s5)' }}>
        {events.map((e) => (
          <div key={e.id} className="list-item" style={{ cursor: 'default' }}>
            <div>
              <div className="list-title">{e.summary}</div>
              <div className="list-sub">
                {e.start ? (e.allDay ? formatDate(e.start) : new Date(e.start).toLocaleString('de-DE')) : ''}
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && <div className="empty">Keine anstehenden Termine.</div>}
      </div>
    </>
  )
}
