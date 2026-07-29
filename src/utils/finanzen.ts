import type { Rechnung, Ausgabe } from '../db/types'
import { rechnungTotals } from './rechnung'
import { montagDerWoche } from './zeiterfassung'
import { todayISO } from './format'

export interface FinanzKennzahlen {
  einnahmen: number
  ausgaben: number
  netto: number
}

// Einnahmen (bezahlte Rechnungen, nach Erstelldatum — kein separates
// Zahlungsdatum vorhanden) minus Ausgaben im Zeitraum [von, bis], beide
// YYYY-MM-DD, inklusive. Gemeinsam genutzt vom Homescreen- und dem
// Finanzen-Jahres-Header, damit beide exakt dieselbe Logik verwenden.
export function berechneFinanzen(rechnungen: Rechnung[], ausgaben: Ausgabe[], von: string, bis: string): FinanzKennzahlen {
  const einnahmen = rechnungen
    .filter((r) => r.zahlungsstatus === 'bezahlt' && r.erstelltAm.slice(0, 10) >= von && r.erstelltAm.slice(0, 10) <= bis)
    .reduce((sum, r) => sum + rechnungTotals(r.positionen, r.ustSatz).brutto, 0)
  const ausg = ausgaben.filter((a) => a.datum >= von && a.datum <= bis).reduce((sum, a) => sum + a.betrag, 0)
  return { einnahmen, ausgaben: ausg, netto: einnahmen - ausg }
}

// Montags-Daten (YYYY-MM-DD) der letzten `anzahl` Kalenderwochen inkl. der
// aktuellen, chronologisch aufsteigend.
export function letzteWochenMontage(anzahl: number): string[] {
  const heuteMontag = montagDerWoche(todayISO())
  const result: string[] = []
  for (let i = anzahl - 1; i >= 0; i--) {
    const d = new Date(`${heuteMontag}T00:00:00`)
    d.setDate(d.getDate() - i * 7)
    result.push(d.toISOString().slice(0, 10))
  }
  return result
}

// Netto-Verlauf (Einnahmen − Ausgaben) je Kalenderwoche, für den Homescreen-
// Header im Monats-Modus.
export function nettoTrendWochen(rechnungen: Rechnung[], ausgaben: Ausgabe[], anzahl: number): number[] {
  return letzteWochenMontage(anzahl).map((montag) => {
    const sonntagDate = new Date(`${montag}T00:00:00`)
    sonntagDate.setDate(sonntagDate.getDate() + 6)
    const sonntag = sonntagDate.toISOString().slice(0, 10)
    return berechneFinanzen(rechnungen, ausgaben, montag, sonntag).netto
  })
}

// Netto-Verlauf je Kalendermonat eines Jahres (12 Werte, Januar–Dezember),
// für den Homescreen-Header im Jahres-Modus und den Finanzen-Jahres-Header.
export function nettoTrendMonateJahr(rechnungen: Rechnung[], ausgaben: Ausgabe[], jahr: number): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const monat = String(i + 1).padStart(2, '0')
    const von = `${jahr}-${monat}-01`
    const letzterTag = new Date(jahr, i + 1, 0).getDate()
    const bis = `${jahr}-${monat}-${String(letzterTag).padStart(2, '0')}`
    return berechneFinanzen(rechnungen, ausgaben, von, bis).netto
  })
}
