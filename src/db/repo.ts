import { supabase } from './supabaseClient'
import { appToRow, makeRepo, rowToApp } from './supa'
import { notify } from './queryBus'
import type {
  Agentur,
  Bewerbung,
  CalendarSyncMap,
  Deadline,
  Kunde,
  Kva,
  Projekt,
  Ratecard,
  Rechnung,
  Stammdaten,
  ToDo,
} from './types'

// Ein Repo pro Tabelle mit einfachem CRUD (kein Sonderverhalten). Ersetzt die
// bisherigen `db.<table>`-Aufrufe 1:1 in Bedeutung (list ~ toArray, get, add,
// update, remove ~ delete), arbeitet aber gegen Supabase/Postgres und meldet
// Änderungen über den queryBus, damit useSupabaseQuery reaktiv bleibt.
export const agenturenRepo = makeRepo<Agentur>('agenturen')
export const ratecardsRepo = makeRepo<Ratecard>('ratecards')
export const kundenRepo = makeRepo<Kunde>('kunden')
export const projekteRepo = makeRepo<Projekt>('projekte')
export const bewerbungenRepo = makeRepo<Bewerbung>('bewerbungen')
export const kvasRepo = makeRepo<Kva>('kvas')
export const rechnungenRepo = makeRepo<Rechnung>('rechnungen')
export const deadlinesRepo = makeRepo<Deadline>('deadlines')
export const todosRepo = makeRepo<ToDo>('todos')
export const calendarSyncMapRepo = makeRepo<CalendarSyncMap>('calendar_sync_map')

// Konkrete Werte aus den Anforderungsunterlagen als Vorbelegung, damit eine
// frisch aufgesetzte Stammdaten-Zeile nicht mit leeren Pflichtfeldern für
// XRechnung/ZUGFeRD startet. Telefon, E-Mail, USt-IdNr. und BIC sind in den
// Unterlagen nicht angegeben und bleiben daher bewusst leer statt geraten.
const STAMMDATEN_DEFAULTS: Stammdaten = {
  id: 1,
  name: 'Markus Kriesmair',
  adresse: 'Spicherenstraße 3\n81667 München',
  strasse: 'Spicherenstraße 3',
  plz: '81667',
  ort: 'München',
  land: 'DE',
  website: 'mkriesmair.online',
  telefon: '',
  email: '',
  steuernummer: '145 150 71 238',
  ustIdNr: '',
  iban: 'DE30100110012847846718',
  bic: '',
  bank: 'N26',
  zahlungsbedingungen: '14 Tage netto',
  googleClientId: '',
  googleCalendarId: 'primary',
  googleLastSyncedAt: '',
}

// Stammdaten sind eine Singleton-Zeile (id=1). Die SQL-Migration legt sie
// bereits initial an; der Fallback hier greift nur, falls die Zeile aus
// irgendeinem Grund fehlt.
export async function getStammdaten(): Promise<Stammdaten> {
  const { data, error } = await supabase.from('stammdaten').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  if (data) return rowToApp<Stammdaten>(data) as Stammdaten
  await putStammdaten(STAMMDATEN_DEFAULTS)
  return STAMMDATEN_DEFAULTS
}

export async function putStammdaten(s: Stammdaten): Promise<void> {
  const row = appToRow(s as unknown as Record<string, unknown>, { keepId: true })
  const { error } = await supabase.from('stammdaten').upsert(row)
  if (error) throw error
  notify('stammdaten')
}

// Löscht eine Agentur. Die zugehörigen Ratecards werden per `on delete
// cascade` serverseitig mitgelöscht, Kunden mit dieser agentur_id werden per
// `on delete set null` entkoppelt statt zu verwaisen (Verbesserung gegenüber
// dem alten Dexie-Verhalten, das dangling agenturId-Referenzen zuließ). Da
// diese Kaskaden serverseitig ohne eigenen Write-Aufruf passieren, muss hier
// manuell benachrichtigt werden, damit betroffene Views neu laden.
export async function removeAgenturCascade(id: number): Promise<void> {
  await agenturenRepo.remove(id)
  notify('ratecards', 'kunden')
}

export async function getRatecardsByAgentur(agenturId: number): Promise<Ratecard[]> {
  const all = await ratecardsRepo.list()
  return all.filter((r) => r.agenturId === agenturId)
}
