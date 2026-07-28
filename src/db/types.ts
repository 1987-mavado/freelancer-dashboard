export interface Stammdaten {
  id: 1
  name: string
  adresse: string
  strasse: string
  plz: string
  ort: string
  land: string
  website: string
  telefon: string
  email: string
  steuernummer: string
  ustIdNr: string
  iban: string
  bic: string
  bank: string
  zahlungsbedingungen: string
  googleClientId: string
  googleCalendarId: string
  googleLastSyncedAt: string
}

export interface Agentur {
  id?: number
  name: string
  kontaktpersonen: string
}

export interface RatecardZeile {
  id: string
  rolle: string
  stundensatz: number
  tagessatz: number
}

export interface Ratecard {
  id?: number
  agenturId: number
  bezeichnung: string
  reduktionProzent?: number
  zeilen: RatecardZeile[]
}

export interface Kunde {
  id?: number
  name: string
  agenturId?: number
}

export type ProjektStatus = 'akquise' | 'aktiv' | 'pausiert' | 'abgeschlossen'

export interface Projekt {
  id?: number
  agenturId?: number
  kundeId: number
  name: string
  nummer: string
  status: ProjektStatus
  von?: string
  bis?: string
}

export type BewerbungStatus = 'anschreiben_raus' | 'call' | 'zusage'

export type BewerbungKanal = 'linkedin_dm' | 'email' | 'linkedin_ausschreibung'

export interface Bewerbung {
  id?: number
  firma: string
  rolle: string
  kanal?: BewerbungKanal
  ausschreibungstext?: string
  anschreiben?: string
  empfaengerEmail?: string
  status: BewerbungStatus
  gespraechDatum?: string
  notiz?: string
  archiviert: boolean
  erstelltAm: string
}

export interface KvaZeile {
  id: string
  rolle: string
  stunden: number
}

export interface KvaPhase {
  id: string
  bezeichnung: string
  beschreibung: string
  zeilen: KvaZeile[]
}

export interface Kva {
  id?: number
  projektId: number
  ratecardId: number
  bezeichnung: string
  phasen: KvaPhase[]
  erstelltAm: string
}

export interface RechnungPosition {
  id: string
  beschreibung: string
  menge: number
  einheit: string
  einzelpreis: number
}

export type Zahlungsstatus = 'offen' | 'bezahlt' | 'ueberfaellig'

export interface Rechnung {
  id?: number
  projektId: number
  rechnungsnummer: string
  rechnungsanschrift: string
  lieferanschrift: string
  empfaengerName: string
  empfaengerStrasse: string
  empfaengerPlz: string
  empfaengerOrt: string
  empfaengerLand: string
  leitwegId: string
  leistungszeitraumVon: string
  leistungszeitraumBis: string
  positionen: RechnungPosition[]
  ustSatz: number
  faelligkeitsdatum: string
  zahlungsstatus: Zahlungsstatus
  erstelltAm: string
}

export type DeadlineBezugTyp = 'bewerbung' | 'projekt' | 'kva' | 'rechnung' | null

export interface Deadline {
  id?: number
  bezugTyp?: DeadlineBezugTyp
  bezugId?: number
  bezeichnung: string
  faelligkeitsdatum: string
  erledigt: boolean
}

export interface ToDo {
  id?: number
  text: string
  erledigt: boolean
  erstelltAm: string
}

export type CalendarEntityTyp = 'deadline' | 'rechnung' | 'projekt' | 'kva' | 'bewerbung'

export interface CalendarSyncMap {
  id?: number
  entityType: CalendarEntityTyp
  entityId: number
  googleEventId: string
  signature: string
  syncedAt: string
}
