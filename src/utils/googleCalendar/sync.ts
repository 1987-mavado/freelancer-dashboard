import {
  deadlinesRepo,
  rechnungenRepo,
  projekteRepo,
  kvasRepo,
  bewerbungenRepo,
  todosRepo,
  calendarSyncMapRepo,
} from '../../db/repo'
import type { CalendarEntityTyp } from '../../db/types'
import { getAccessToken } from './auth'
import { deleteEvent, insertEvent, patchEvent } from './api'
import {
  buildBewerbungTarget,
  buildDeadlineTarget,
  buildKvaTarget,
  buildProjektTarget,
  buildRechnungTarget,
  buildTodoTarget,
  type SyncTarget,
} from './eventBuilders'

export interface SyncResult {
  created: number
  updated: number
  deleted: number
  unchanged: number
  errors: string[]
}

function mapKey(entityType: CalendarEntityTyp, entityId: number): string {
  return `${entityType}:${entityId}`
}

export async function syncGoogleCalendar(clientId: string, calendarId: string): Promise<SyncResult> {
  const accessToken = await getAccessToken(clientId)

  const [allDeadlines, allRechnungen, projekte, kvas, bewerbungen, allTodos, existingMap] = await Promise.all([
    deadlinesRepo.list(),
    rechnungenRepo.list(),
    projekteRepo.list(),
    kvasRepo.list(),
    bewerbungenRepo.list(),
    todosRepo.list(),
    calendarSyncMapRepo.list(),
  ])
  const rechnungen = allRechnungen.filter((r) => r.zahlungsstatus !== 'bezahlt')
  const deadlines = allDeadlines.filter((d) => !d.erledigt)
  const todos = allTodos.filter((t) => !t.erledigt && t.faelligkeitsdatum)

  const projektNameById = new Map(projekte.map((p) => [p.id!, p.name]))
  const kvaLabelById = new Map(kvas.map((k) => [k.id!, k.bezeichnung]))
  const rechnungLabelById = new Map(rechnungen.map((r) => [r.id!, r.rechnungsnummer]))
  const bewerbungLabelById = new Map(bewerbungen.map((b) => [b.id!, `${b.firma} (${b.rolle})`]))

  function bezugLabel(bezugTyp: string | null | undefined, bezugId: number | undefined): string | undefined {
    if (!bezugTyp || !bezugId) return undefined
    if (bezugTyp === 'projekt') return projektNameById.get(bezugId)
    if (bezugTyp === 'kva') return kvaLabelById.get(bezugId)
    if (bezugTyp === 'rechnung') return rechnungLabelById.get(bezugId)
    if (bezugTyp === 'bewerbung') return bewerbungLabelById.get(bezugId)
    return undefined
  }

  const targets: SyncTarget[] = []
  for (const d of deadlines) {
    if (!d.id) continue
    targets.push(buildDeadlineTarget(d, bezugLabel(d.bezugTyp, d.bezugId)))
  }
  for (const r of rechnungen) {
    if (!r.id) continue
    targets.push(buildRechnungTarget(r, projektNameById.get(r.projektId)))
  }
  for (const p of projekte) {
    if (!p.id) continue
    const t = buildProjektTarget(p)
    if (t) targets.push(t)
  }
  for (const k of kvas) {
    if (!k.id) continue
    targets.push(buildKvaTarget(k, projektNameById.get(k.projektId)))
  }
  for (const b of bewerbungen) {
    if (!b.id) continue
    const t = buildBewerbungTarget(b)
    if (t) targets.push(t)
  }
  for (const td of todos) {
    if (!td.id) continue
    const t = buildTodoTarget(td, td.projektId ? projektNameById.get(td.projektId) : undefined)
    if (t) targets.push(t)
  }

  const targetsByKey = new Map(targets.map((t) => [mapKey(t.entityType, t.entityId), t]))
  const mapByKey = new Map(existingMap.map((m) => [mapKey(m.entityType, m.entityId), m]))

  const result: SyncResult = { created: 0, updated: 0, deleted: 0, unchanged: 0, errors: [] }

  for (const [key, t] of targetsByKey) {
    const existing = mapByKey.get(key)
    try {
      if (!existing) {
        const googleEventId = await insertEvent(accessToken, calendarId, t.draft)
        await calendarSyncMapRepo.add({
          entityType: t.entityType,
          entityId: t.entityId,
          googleEventId,
          signature: t.signature,
          syncedAt: new Date().toISOString(),
        })
        result.created++
      } else if (existing.signature !== t.signature) {
        await patchEvent(accessToken, calendarId, existing.googleEventId, t.draft)
        await calendarSyncMapRepo.update(existing.id!, {
          signature: t.signature,
          syncedAt: new Date().toISOString(),
        })
        result.updated++
      } else {
        result.unchanged++
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  for (const [key, m] of mapByKey) {
    if (targetsByKey.has(key)) continue
    try {
      await deleteEvent(accessToken, calendarId, m.googleEventId)
      await calendarSyncMapRepo.remove(m.id!)
      result.deleted++
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return result
}
