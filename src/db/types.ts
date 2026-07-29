// Ein Stammdaten-Datensatz pro Account (Multi-User), gefunden über die
// Datenbankspalte user_id (RLS-gefiltert) statt über eine feste id.
export interface Stammdaten {
  id?: number
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
  logoUrl: string
  rechnungAbschlusstext: string
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

export type KvaStatus = 'entwurf' | 'gesendet' | 'angenommen' | 'abgelehnt'

export interface Kva {
  id?: number
  projektId: number
  ratecardId: number
  bezeichnung: string
  phasen: KvaPhase[]
  status: KvaStatus
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
  bestellnummer: string
  rechnungsanschrift: string
  lieferanschrift: string
  empfaengerName: string
  empfaengerStrasse: string
  empfaengerPlz: string
  empfaengerOrt: string
  empfaengerLand: string
  leitwegId: string
  // Für die Rechnungs-Überschrift "Rechnung – Nr – Kunde – Tätigkeit".
  taetigkeit: string
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

// To-Do und Stundentool sind ein gemeinsames Feld: eine Aufgabe kann optional
// mit einem Projekt/einer Rolle und einer geschätzten Zeit hinterlegt werden
// — dann lässt sich direkt per Play-Icon ein Timer dafür starten (siehe
// TimerContext), dessen erfasste Zeit als Zeiteintrag (mit `todoId`-Bezug)
// in die Abrechnung einfließt. Ohne Projekt/Zeit bleibt es eine normale,
// nicht abrechenbare Aufgabe.
export interface ToDo {
  id?: number
  text: string
  erledigt: boolean
  geschaetzteMinuten: number
  projektId: number | null
  rolle: string
  // Optional, nur wenn gesetzt wird das To-Do in den Google-Kalender-Sync
  // aufgenommen (Kalendereinträge brauchen ein Datum).
  faelligkeitsdatum: string
  erstelltAm: string
}

// Zeiterfassung: Start/Stopp-Timer + manuelle Einträge, verknüpft mit
// Projekt + Rolle. `laeuft`/`startZeit` bilden einen laufenden Timer ab
// (dauerMinuten ist dann noch 0 und wird erst beim Stoppen berechnet);
// bei manuellen Einträgen bleibt startZeit leer und dauerMinuten wird direkt
// eingegeben. `abgerechnet`/`rechnungId` markieren, ob/in welche Rechnung
// der Eintrag bereits als Position übernommen wurde.
export interface Zeiteintrag {
  id?: number
  projektId: number
  rolle: string
  datum: string
  startZeit: string | null
  dauerMinuten: number
  laeuft: boolean
  beschreibung: string
  abgerechnet: boolean
  rechnungId?: number | null
  // Verknüpfung zum ToDo/Stundentool-Eintrag, falls über dessen Play-Icon
  // gestartet — für die kumulierte Stundenzahl je Aufgabe.
  todoId?: number | null
  erstelltAm: string
}

// Ausgaben-Erfassung: Betriebsausgaben mit fester Kategorie und optionalem
// Beleg-Upload (Foto/PDF, als URL in Supabase Storage im Bucket "belege").
// Fließt in die Jahresübersicht (Steuer) als Gegenstück zu den Einnahmen ein.
export type AusgabeKategorie =
  | 'software'
  | 'buero_material'
  | 'reisekosten'
  | 'marketing'
  | 'bewirtung'
  | 'sonstiges'

// Anlass für Bewirtungsbelege (Kategorie "bewirtung"), z.B. für die
// Dokumentationspflichten des Finanzamts bei Geschäftsessen.
export type BewirtungAnlass = 'bewerbung' | 'kundenakquise' | 'sonstiges'

export interface Ausgabe {
  id?: number
  datum: string
  kategorie: AusgabeKategorie
  betrag: number
  beschreibung: string
  belegUrl: string
  // Nur relevant/befüllt bei kategorie === 'bewirtung'.
  bewirtungTeilnehmer: string
  bewirtungLokal: string
  bewirtungAnlass: BewirtungAnlass | ''
  erstelltAm: string
}

export type CalendarEntityTyp = 'deadline' | 'rechnung' | 'projekt' | 'kva' | 'bewerbung' | 'todo'

export interface CalendarSyncMap {
  id?: number
  entityType: CalendarEntityTyp
  entityId: number
  googleEventId: string
  signature: string
  syncedAt: string
}
