import { zeiteintraegeRepo } from '../db/repo'
import type { Zeiteintrag } from '../db/types'
import { todayISO } from './format'

// Startet einen neuen Timer. Der Aufrufer muss vorher sicherstellen, dass
// aktuell kein anderer Timer läuft (nur einer gleichzeitig, siehe
// `zeiteintraege_only_one_running_idx` in der Migration, die das zusätzlich
// serverseitig absichert).
export async function starteTimer(projektId: number, rolle: string): Promise<number> {
  const eintrag: Zeiteintrag = {
    projektId,
    rolle,
    datum: todayISO(),
    startZeit: new Date().toISOString(),
    dauerMinuten: 0,
    laeuft: true,
    beschreibung: '',
    abgerechnet: false,
    erstelltAm: new Date().toISOString(),
  }
  return zeiteintraegeRepo.add(eintrag)
}

// Stoppt einen laufenden Timer und berechnet die Dauer aus der verstrichenen
// Zeit seit `startZeit` (mind. 1 Minute, damit ein Sofort-wieder-Stoppen
// nicht als 0-Minuten-Eintrag verschwindet).
export async function stoppeTimer(eintrag: Zeiteintrag, beschreibung?: string): Promise<void> {
  if (!eintrag.id || !eintrag.startZeit) return
  const start = new Date(eintrag.startZeit).getTime()
  const dauerMinuten = Math.max(1, Math.round((Date.now() - start) / 60000))
  await zeiteintraegeRepo.update(eintrag.id, {
    laeuft: false,
    dauerMinuten,
    ...(beschreibung !== undefined ? { beschreibung } : {}),
  })
}

// z.B. 95 -> "1:35 h"
export function formatDauer(minuten: number): string {
  const total = Math.max(0, Math.round(minuten))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}:${String(m).padStart(2, '0')} h`
}

// Live-Anzeige für einen laufenden Timer, z.B. 5425s -> "01:30:25"
export function formatVerstrichen(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function minutenZuStunden(minuten: number): number {
  return minuten / 60
}
