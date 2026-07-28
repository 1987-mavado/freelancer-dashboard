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

export async function listUpcomingEvents(
  accessToken: string,
  calendarId: string,
  maxResults = 6,
): Promise<CalendarEventSummary[]> {
  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  })
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
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

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Kalendereintrag konnte nicht gelöscht werden: ${await parseErrorMessage(res)}`)
  }
}
