import type { Kva, Ratecard } from '../db/types'

export interface RoleBreakdownEntry {
  rolle: string
  stunden: number
  summe: number
}

export interface PhaseResult {
  phaseId: string
  bezeichnung: string
  summe: number
}

export interface KvaComputed {
  phasenSummen: PhaseResult[]
  rollenAufschluesselung: RoleBreakdownEntry[]
  gesamtsumme: number
}

export function rateFor(ratecard: Ratecard | undefined, rolle: string): number {
  return ratecard?.zeilen.find((z) => z.rolle === rolle)?.stundensatz ?? 0
}

export function computeKva(kva: Kva, ratecard: Ratecard | undefined): KvaComputed {
  const phasenSummen: PhaseResult[] = []
  const roleMap = new Map<string, RoleBreakdownEntry>()

  for (const phase of kva.phasen) {
    let phaseSumme = 0
    for (const zeile of phase.zeilen) {
      const satz = rateFor(ratecard, zeile.rolle)
      const summe = satz * zeile.stunden
      phaseSumme += summe
      const existing = roleMap.get(zeile.rolle)
      if (existing) {
        existing.stunden += zeile.stunden
        existing.summe += summe
      } else {
        roleMap.set(zeile.rolle, { rolle: zeile.rolle, stunden: zeile.stunden, summe })
      }
    }
    phasenSummen.push({ phaseId: phase.id, bezeichnung: phase.bezeichnung, summe: phaseSumme })
  }

  const gesamtsumme = phasenSummen.reduce((sum, p) => sum + p.summe, 0)

  return {
    phasenSummen,
    rollenAufschluesselung: Array.from(roleMap.values()),
    gesamtsumme,
  }
}
