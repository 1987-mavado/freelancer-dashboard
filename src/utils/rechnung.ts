import { supabase } from '../db/supabaseClient'
import { projekteRepo, agenturenRepo, kundenRepo, rechnungenRepo } from '../db/repo'
import type { Rechnung, RechnungPosition } from '../db/types'
import { todayISO, addDaysISO } from './format'

// Ermittelt für ein gegebenes Präfix (z.B. "KUNDE-26-") die nächste freie
// laufende Nummer. Bewusst MAX-basiert (höchste bereits vergebene Nummer + 1)
// statt COUNT-basiert: bei COUNT würde das Löschen einer Rechnung dazu
// führen, dass die nächste neu vergebene Nummer eine bereits verwendete
// Nummer erneut trifft (Kollisionsgefahr trotz `unique`-Constraint in der
// DB). MAX ist robust gegenüber Lücken durch gelöschte/umbenannte Rechnungen.
export async function nextRechnungsnummer(prefix: string): Promise<string> {
  const { data, error } = await supabase
    .from('rechnungen')
    .select('rechnungsnummer')
    .like('rechnungsnummer', `${prefix}%`)
  if (error) throw error
  let max = 0
  for (const row of data ?? []) {
    const suffix = (row.rechnungsnummer as string).slice(prefix.length)
    const n = parseInt(suffix, 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

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
  return nextRechnungsnummer(prefix)
}

// Leere Rechnung mit sinnvollen Vorbelegungen. Wird sowohl von der manuellen
// Neuanlage (RechnungDetail.tsx) als auch vom Auto-Anlegen beim Abschluss
// eines Projekts (ProjektDetail.tsx) verwendet.
export function emptyRechnung(projektId: number, nummer: string): Rechnung {
  return {
    projektId,
    rechnungsnummer: nummer,
    bestellnummer: '',
    rechnungsanschrift: '',
    lieferanschrift: '',
    empfaengerName: '',
    empfaengerStrasse: '',
    empfaengerPlz: '',
    empfaengerOrt: '',
    empfaengerLand: 'DE',
    leitwegId: '',
    taetigkeit: '',
    leistungszeitraumVon: todayISO(),
    leistungszeitraumBis: todayISO(),
    positionen: [],
    ustSatz: 19,
    faelligkeitsdatum: addDaysISO(14),
    zahlungsstatus: 'offen',
    erstelltAm: new Date().toISOString(),
  }
}

// Legt automatisch eine leere Rechnung an, sobald ein Projekt auf
// "abgeschlossen" gesetzt wird — aber nur, wenn für dieses Projekt noch
// keine Rechnung existiert (verhindert Duplikate bei mehrfachem Speichern
// im Status "abgeschlossen"). Adresse und Positionen müssen danach manuell
// ergänzt werden, da Kunden/Agenturen aktuell keine Adressdaten hinterlegt
// haben. Gibt die ID der neu angelegten Rechnung zurück, oder `undefined`,
// wenn bereits eine Rechnung existiert (dann wurde nichts angelegt).
export async function ensureRechnungFuerAbgeschlossenesProjekt(projektId: number): Promise<number | undefined> {
  const alle = await rechnungenRepo.list()
  const vorhanden = alle.some((r) => r.projektId === projektId)
  if (vorhanden) return undefined
  const nummer = await generateRechnungsnummer(projektId)
  const rechnung = emptyRechnung(projektId, nummer)
  return rechnungenRepo.add(rechnung)
}

// Für den Häkchen-Button in der Zeiterfassung: liefert die id einer noch
// nicht bezahlten Rechnung für dieses Projekt (legt eine neue an, falls
// keine offene existiert), damit erfasste Stunden dort übernommen werden
// können. Anders als ensureRechnungFuerAbgeschlossenesProjekt (die nur beim
// allerersten Projektabschluss greift) wird hier bewusst auch dann eine neue
// Rechnung erzeugt, wenn frühere Rechnungen für das Projekt bereits bezahlt
// sind — für neu angefallene, noch unabgerechnete Stunden.
export async function ensureOffeneRechnungFuerProjekt(projektId: number): Promise<number> {
  const alle = await rechnungenRepo.list()
  const bestehende = alle.find((r) => r.projektId === projektId && r.zahlungsstatus !== 'bezahlt')
  if (bestehende?.id) return bestehende.id
  const nummer = await generateRechnungsnummer(projektId)
  const rechnung = emptyRechnung(projektId, nummer)
  return rechnungenRepo.add(rechnung)
}

export function rechnungTotals(positionen: RechnungPosition[], ustSatz: number) {
  const netto = positionen.reduce((sum, p) => sum + p.menge * p.einzelpreis, 0)
  const ustBetrag = netto * (ustSatz / 100)
  const brutto = netto + ustBetrag
  return { netto, ustBetrag, brutto }
}
