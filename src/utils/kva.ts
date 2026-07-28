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

// Ein Arbeitstag wird für die Umrechnung Tagessatz -> Stundensatz mit 8h
// angesetzt (branchenüblicher Standard bei Freelancer-Tagessätzen).
const STUNDEN_PRO_TAG = 8

// Liefert den effektiven Stundensatz für eine Rolle. Wenn in der Ratecard
// nur ein Tagessatz hinterlegt ist (Std.-Satz = 0), wird der Stundensatz
// automatisch daraus abgeleitet, statt mit 0 zu rechnen — sonst zeigte die
// Ausgabe/PDF/Excel trotz vereinbartem Tagessatz überall 0,00 €.
export function rateFor(ratecard: Ratecard | undefined, rolle: string): number {
  const zeile = ratecard?.zeilen.find((z) => z.rolle === rolle)
  if (!zeile) return 0
  if (zeile.stundensatz > 0) return zeile.stundensatz
  if (zeile.tagessatz > 0) return zeile.tagessatz / STUNDEN_PRO_TAG
  return 0
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
