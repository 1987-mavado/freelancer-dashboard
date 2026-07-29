import { supabase } from '../db/supabaseClient'
import { agenturenRepo, kundenRepo } from '../db/repo'
import type { Projekt } from '../db/types'

// Gleiches MAX-Präfix-Prinzip wie bei nextRechnungsnummer (siehe
// utils/rechnung.ts) — robust gegenüber Lücken durch gelöschte/umbenannte
// Projekte, respektiert manuelle Änderungen der Jobnummer.
async function nextJobnummer(prefix: string): Promise<string> {
  const { data, error } = await supabase.from('projekte').select('nummer').like('nummer', `${prefix}%`)
  if (error) throw error
  let max = 0
  for (const row of data ?? []) {
    const suffix = (row.nummer as string).slice(prefix.length)
    const n = parseInt(suffix, 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

// Vergibt beim Annehmen einer KVA automatisch eine Jobnummer für das
// zugehörige Projekt, falls dort noch keine (freie Texteingabe) hinterlegt
// wurde — Zeiterfassung/Fokus zeigen diese Nummer künftig in der
// Projektauswahl an.
export async function generateJobnummer(projekt: Projekt): Promise<string> {
  let codeBase = 'JOB'
  if (projekt.agenturId) {
    const agentur = await agenturenRepo.get(projekt.agenturId)
    if (agentur?.name) codeBase = agentur.name
  } else {
    const kunde = await kundenRepo.get(projekt.kundeId)
    if (kunde?.name) codeBase = kunde.name
  }
  const code = codeBase.split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g, '') || 'JOB'
  const year2 = String(new Date().getFullYear()).slice(-2)
  const prefix = `${code}-${year2}-`
  return nextJobnummer(prefix)
}
