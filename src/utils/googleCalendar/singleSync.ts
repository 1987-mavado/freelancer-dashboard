import { calendarSyncMapRepo, getStammdaten } from '../../db/repo'
import { getAccessToken } from './auth'
import { insertEvent, patchEvent } from './api'
import type { SyncTarget } from './eventBuilders'

/**
 * Schreibt einen einzelnen Kalender-Eintrag sofort (statt auf den nächsten
 * manuellen "Verbinden & synchronisieren"-Lauf zu warten) — für Ereignisse,
 * die laut Anforderung in Echtzeit im Kalender auftauchen sollen (neue
 * Deadline, Bewerbung-Status wechselt zu "Call" mit Termin). Wirft absichtlich
 * nie einen Fehler nach außen: Kalender-Sync ist ein Komfort-Feature und darf
 * das eigentliche Speichern nie blockieren oder fehlschlagen lassen (z. B.
 * wenn Google-Kalender noch nicht verbunden ist, offline gearbeitet wird,
 * oder das Consent-Popup blockiert wurde). Nicht synchronisierte Änderungen
 * werden beim nächsten manuellen Sync-Lauf nachgeholt, da der dort verwendete
 * Signatur-Vergleich denselben Zielzustand berechnet.
 */
export async function trySyncSingleEvent(target: SyncTarget | null): Promise<void> {
  if (!target) return
  try {
    const stammdaten = await getStammdaten()
    if (!stammdaten.googleClientId.trim()) return

    const accessToken = await getAccessToken(stammdaten.googleClientId)
    const calendarId = stammdaten.googleCalendarId || 'primary'

    const existingMap = await calendarSyncMapRepo.list()
    const existing = existingMap.find(
      (m) => m.entityType === target.entityType && m.entityId === target.entityId,
    )

    if (existing) {
      if (existing.signature === target.signature) return
      await patchEvent(accessToken, calendarId, existing.googleEventId, target.draft)
      await calendarSyncMapRepo.update(existing.id!, {
        signature: target.signature,
        syncedAt: new Date().toISOString(),
      })
    } else {
      const googleEventId = await insertEvent(accessToken, calendarId, target.draft)
      await calendarSyncMapRepo.add({
        entityType: target.entityType,
        entityId: target.entityId,
        googleEventId,
        signature: target.signature,
        syncedAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      'Sofort-Sync mit Google Kalender fehlgeschlagen (wird beim nächsten manuellen Sync nachgeholt):',
      err,
    )
  }
}
