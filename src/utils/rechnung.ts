import { supabase } from '../db/supabaseClient'
import { projekteRepo, agenturenRepo, kundenRepo } from '../db/repo'
import type { RechnungPosition } from '../db/types'

export async function generateRechnungsnummer(projektId: number): Promise<string> {
  const projekt = await projekteRepo.get(projektId)
  let codeBase = 'KUNDE'
  if (projekt) {
    if (projekt.agenturId) {
      const agentur = await agenturenRepo.get(projekt.agenturId)
      if (agentur?.name) codeBase = agentur.name
    } else {
      const kunde = await kundenRepo.get(projekt.kundeId)
      if (kunde?.name) codeBase = kunde.name
    }
  }
  const code = codeBase.split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '') || 'KUNDE'
  const year2 = String(new Date().getFullYear()).slice(-2)
  const prefix = `${code}-${year2}-`
  // Einzelnutzer-App mit geringem Schreibvolumen: Zählen per COUNT statt
  // client-seitigem Laden aller Zeilen. Bei theoretisch gleichzeitigen
  // Schreibzugriffen könnte es zu doppelten Nummern kommen (kein
  // DB-seitiger Sequence-Lock) — für den Ein-Personen-Betrieb akzeptables
  // Risiko, `rechnungsnummer` bleibt zusätzlich `unique` in der DB, sodass
  // ein Kollisionsfall beim Speichern zumindest sichtbar fehlschlägt statt
  // still zwei Rechnungen mit derselben Nummer anzulegen.
  const { count, error } = await supabase
    .from('rechnungen')
    .select('id', { count: 'exact', head: true })
    .like('rechnungsnummer', `${prefix}%`)
  if (error) throw error
  const next = (count ?? 0) + 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export function rechnungTotals(positionen: RechnungPosition[], ustSatz: number) {
  const netto = positionen.reduce((sum, p) => sum + p.menge * p.einzelpreis, 0)
  const ustBetrag = netto * (ustSatz / 100)
  const brutto = netto + ustBetrag
  return { netto, ustBetrag, brutto }
}
