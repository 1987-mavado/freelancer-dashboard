import { supabase } from './supabaseClient'
import { appToRow, makeRepo, rowToApp } from './supa'
import { notify } from './queryBus'
import type {
  Agentur,
  Ausgabe,
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
  Zeiteintrag,
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
export const zeiteintraegeRepo = makeRepo<Zeiteintrag>('zeiteintraege')
export const ausgabenRepo = makeRepo<Ausgabe>('ausgaben')

// Konkrete Werte aus den Anforderungsunterlagen als Vorbelegung, damit eine
// frisch aufgesetzte Stammdaten-Zeile nicht mit leeren Pflichtfeldern für
// XRechnung/ZUGFeRD startet. Telefon, E-Mail, USt-IdNr. und BIC sind in den
// Unterlagen nicht angegeben und bleiben daher bewusst leer statt geraten.
// Vorbelegung nur noch für brandneue Accounts sinnvoll benannt (Name/Adresse
// etc. sind hier bewusst leer statt mit Markus' Daten vorbefüllt, da diese
// Defaults inzwischen für jeden neuen Account gelten — nicht nur für einen).
const STAMMDATEN_DEFAULTS: Stammdaten = {
  name: '',
  adresse: '',
  strasse: '',
  plz: '',
  ort: '',
  land: 'DE',
  website: '',
  telefon: '',
  email: '',
  steuernummer: '',
  ustIdNr: '',
  iban: '',
  bic: '',
  bank: '',
  zahlungsbedingungen: '14 Tage netto',
  logoUrl: '',
  rechnungAbschlusstext:
    'Vielen Dank für die Zusammenarbeit.\nTerms of payment: Payment is due 14 days after receipt of invoice.\nBitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer auf das unten angegebene Konto.\nDer Rechnungsbetrag ist bis 14 Tage nach Rechnungseingang fällig.\nMit freundlichen Grüßen',
  googleClientId: '',
  googleCalendarId: 'primary',
  googleLastSyncedAt: '',
}

// Stammdaten: eine Zeile pro Account, RLS filtert automatisch auf den
// eingeloggten Nutzer (user_id = auth.uid()) — kein Filter auf `id` mehr
// nötig/möglich, seit es kein festes Singleton (id=1) mehr gibt.
export async function getStammdaten(): Promise<Stammdaten> {
  const { data, error } = await supabase.from('stammdaten').select('*').maybeSingle()
  if (error) throw error
  if (data) return rowToApp<Stammdaten>(data) as Stammdaten
  await putStammdaten(STAMMDATEN_DEFAULTS)
  return STAMMDATEN_DEFAULTS
}

// Upsert über die (pro Account eindeutige) Spalte user_id statt über `id`,
// da jeder Account jetzt seine eigene Stammdaten-Zeile hat.
export async function putStammdaten(s: Stammdaten): Promise<void> {
  const row = appToRow(s as unknown as Record<string, unknown>, { keepId: true })
  const { error } = await supabase.from('stammdaten').upsert(row, { onConflict: 'user_id' })
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
