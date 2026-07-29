export interface CalendarEventDraft {
  summary: string
  description?: string
  start: { date?: string; dateTime?: string; timeZone?: string }
  end: { date?: string; dateTime?: string; timeZone?: string }
}

const BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars'

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.error?.message || `${res.status} ${res.statusText}`
  } catch {
    return `${res.status} ${res.statusText}`
  }
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  draft: CalendarEventDraft,
): Promise<string> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (!res.ok) throw new Error(`Kalendereintrag konnte nicht erstellt werden: ${await parseErrorMessage(res)}`)
  const created = await res.json()
  return created.id as string
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  draft: CalendarEventDraft,
): Promise<void> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  })
  if (!res.ok) throw new Error(`Kalendereintrag konnte nicht aktualisiert werden: ${await parseErrorMessage(res)}`)
}

export interface CalendarEventSummary {
  id: string
  summary: string
  start?: string
  allDay: boolean
}

// Roher Event-Abruf für einen beliebigen Zeitraum — Basis sowohl für
// `listUpcomingEvents` (nächste Termine, offenes Ende) als auch für die
// Wochenübersicht in der Deadlines-Ansicht (fester Zeitraum).
async function listEventsRaw(
  accessToken: string,
  calendarId: string,
  params: Record<string, string>,
): Promise<CalendarEventSummary[]> {
  const query = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', ...params })
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(calendarId)}/events?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Kalendereinträge konnten nicht geladen werden: ${await parseErrorMessage(res)}`)
  const body = await res.json()
  const items = (body.items ?? []) as Array<{
    id: string
    summary?: string
    start?: { date?: string; dateTime?: string }
  }>
  return items.map((it) => ({
    id: it.id,
    summary: it.summary || '(Ohne Titel)',
    start: it.start?.dateTime ?? it.start?.date,
    allDay: !it.start?.dateTime,
  }))
}

export async function listUpcomingEvents(
  accessToken: string,
  calendarId: string,
  maxResults = 6,
): Promise<CalendarEventSummary[]> {
  return listEventsRaw(accessToken, calendarId, {
    timeMin: new Date().toISOString(),
    maxResults: String(maxResults),
  })
}

// Termine in einem festen Zeitfenster (z.B. eine Kalenderwoche) — für die
// Wochenübersicht in der Deadlines-Ansicht.
export async function listEventsBetween(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEventSummary[]> {
  return listEventsRaw(accessToken, calendarId, { timeMin, timeMax, maxResults: '50' })
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Kalendereintrag konnte nicht gelöscht werden: ${await parseErrorMessage(res)}`)
  }
}
