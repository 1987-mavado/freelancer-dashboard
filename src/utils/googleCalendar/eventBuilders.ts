import type { Bewerbung, CalendarEntityTyp, Deadline, Kva, Projekt, Rechnung, ToDo } from '../../db/types'
import { rechnungTotals } from '../rechnung'
import { formatEuro } from '../format'
import type { CalendarEventDraft } from './api'

export interface SyncTarget {
  entityType: CalendarEntityTyp
  entityId: number
  draft: CalendarEventDraft
  signature: string
}

function toDateOnly(isoDate: string): string {
  return isoDate.slice(0, 10)
}

function addOneDay(dateOnly: string): string {
  const d = new Date(`${dateOnly}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function target(entityType: CalendarEntityTyp, entityId: number, draft: CalendarEventDraft): SyncTarget {
  return { entityType, entityId, draft, signature: JSON.stringify(draft) }
}

export function buildDeadlineTarget(deadline: Deadline, bezugLabel?: string): SyncTarget {
  const date = toDateOnly(deadline.faelligkeitsdatum)
  return target('deadline', deadline.id!, {
    summary: deadline.bezeichnung,
    description: bezugLabel ? `Verknüpft mit: ${bezugLabel}` : undefined,
    start: { date },
    end: { date: addOneDay(date) },
  })
}

export function buildRechnungTarget(rechnung: Rechnung, projektName?: string): SyncTarget {
  const { brutto } = rechnungTotals(rechnung.positionen, rechnung.ustSatz)
  const date = toDateOnly(rechnung.faelligkeitsdatum)
  const descriptionParts = [
    `Rechnung ${rechnung.rechnungsnummer}`,
    rechnung.empfaengerName ? `an ${rechnung.empfaengerName}` : null,
    projektName ? `Projekt: ${projektName}` : null,
    `Betrag: ${formatEuro(brutto)}`,
    `Status: ${rechnung.zahlungsstatus}`,
  ].filter(Boolean)
  return target('rechnung', rechnung.id!, {
    summary: `Rechnung fällig: ${rechnung.rechnungsnummer}`,
    description: descriptionParts.join('\n'),
    start: { date },
    end: { date: addOneDay(date) },
  })
}

export function buildProjektTarget(projekt: Projekt): SyncTarget | null {
  const von = projekt.von ? toDateOnly(projekt.von) : undefined
  const bis = projekt.bis ? toDateOnly(projekt.bis) : undefined
  if (!von && !bis) return null

  const start = von ?? bis!
  const end = bis ?? von!
  return target('projekt', projekt.id!, {
    summary: `Projekt: ${projekt.name}`,
    description: projekt.nummer ? `Projektnummer: ${projekt.nummer}` : undefined,
    start: { date: start },
    end: { date: addOneDay(end) },
  })
}

function toLocalDateTimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Bewerbungs-Calls sind terminierte Gespräche (Datum + Uhrzeit), anders als
// die übrigen, ganztägigen Kalendereinträge. Nur relevant, solange Status
// "call" ist und ein Termin gesetzt wurde — ansonsten kein Eintrag (wird bei
// der nächsten manuellen Synchronisierung ggf. wieder entfernt, falls sich
// der Status wieder ändert).
export function buildBewerbungTarget(bewerbung: Bewerbung): SyncTarget | null {
  if (bewerbung.status !== 'call' || !bewerbung.gespraechDatum) return null
  const start = new Date(bewerbung.gespraechDatum)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return target('bewerbung', bewerbung.id!, {
    summary: `Call: ${bewerbung.firma} (${bewerbung.rolle})`,
    description: bewerbung.notiz || undefined,
    start: { dateTime: toLocalDateTimeString(start), timeZone },
    end: { dateTime: toLocalDateTimeString(end), timeZone },
  })
}

// To-Dos nur dann synchronisieren, wenn ein Fälligkeitsdatum gesetzt ist —
// ohne Datum lässt sich kein Kalendereintrag anlegen.
export function buildTodoTarget(todo: ToDo, projektName?: string): SyncTarget | null {
  if (!todo.faelligkeitsdatum) return null
  const date = toDateOnly(todo.faelligkeitsdatum)
  return target('todo', todo.id!, {
    summary: `To-Do: ${todo.text}`,
    description: projektName ? `Projekt: ${projektName}` : undefined,
    start: { date },
    end: { date: addOneDay(date) },
  })
}

export function buildKvaTarget(kva: Kva, projektName?: string): SyncTarget {
  const date = toDateOnly(kva.erstelltAm)
  return target('kva', kva.id!, {
    summary: `KVA erstellt: ${kva.bezeichnung}`,
    description: projektName ? `Projekt: ${projektName}` : undefined,
    start: { date },
    end: { date: addOneDay(date) },
  })
}
