-- Freelancer-Dashboard: initiales Schema
-- Einzelnutzer-App: keine user_id-Spalten, RLS erlaubt vollen Zugriff für
-- jeden authentifizierten Nutzer. Da Self-Signup deaktiviert bleibt und nur
-- ein Account manuell angelegt wird, ist das ausreichend (siehe Auth-Setup
-- in der Anleitung).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Stammdaten (Singleton, id ist immer 1)
-- ---------------------------------------------------------------------
create table stammdaten (
  id smallint primary key default 1 check (id = 1),
  name text not null default '',
  adresse text not null default '',
  strasse text not null default '',
  plz text not null default '',
  ort text not null default '',
  land text not null default 'DE',
  website text not null default '',
  telefon text not null default '',
  email text not null default '',
  steuernummer text not null default '',
  ust_id_nr text not null default '',
  iban text not null default '',
  bic text not null default '',
  bank text not null default '',
  zahlungsbedingungen text not null default '14 Tage netto',
  google_client_id text not null default '',
  google_calendar_id text not null default 'primary',
  google_last_synced_at timestamptz
);

-- ---------------------------------------------------------------------
-- Agenturen
-- ---------------------------------------------------------------------
create table agenturen (
  id bigint generated always as identity primary key,
  name text not null,
  kontaktpersonen text not null default ''
);

-- ---------------------------------------------------------------------
-- Ratecards (Zeilen als JSONB, wie bisher in Dexie eingebettet)
-- ---------------------------------------------------------------------
create table ratecards (
  id bigint generated always as identity primary key,
  agentur_id bigint not null references agenturen(id) on delete cascade,
  bezeichnung text not null,
  reduktion_prozent numeric,
  zeilen jsonb not null default '[]'::jsonb
);
create index ratecards_agentur_id_idx on ratecards(agentur_id);

-- ---------------------------------------------------------------------
-- Kunden
-- ---------------------------------------------------------------------
create table kunden (
  id bigint generated always as identity primary key,
  name text not null,
  agentur_id bigint references agenturen(id) on delete set null
);
create index kunden_agentur_id_idx on kunden(agentur_id);

-- ---------------------------------------------------------------------
-- Projekte
-- ---------------------------------------------------------------------
create table projekte (
  id bigint generated always as identity primary key,
  agentur_id bigint references agenturen(id) on delete set null,
  kunde_id bigint not null references kunden(id) on delete cascade,
  name text not null,
  nummer text not null default '',
  status text not null default 'akquise'
    check (status in ('akquise', 'aktiv', 'pausiert', 'abgeschlossen')),
  von date,
  bis date
);
create index projekte_kunde_id_idx on projekte(kunde_id);
create index projekte_status_idx on projekte(status);

-- ---------------------------------------------------------------------
-- Bewerbungen (erweitert um Kanal/Ausschreibungstext/Anschreiben/E-Mail
-- gemäß Anforderungsdokument)
-- ---------------------------------------------------------------------
create table bewerbungen (
  id bigint generated always as identity primary key,
  firma text not null,
  rolle text not null default '',
  kanal text
    check (kanal in ('linkedin_dm', 'email', 'linkedin_ausschreibung')),
  ausschreibungstext text not null default '',
  anschreiben text not null default '',
  empfaenger_email text not null default '',
  status text not null default 'anschreiben_raus'
    check (status in ('anschreiben_raus', 'call', 'zusage')),
  gespraech_datum timestamptz,
  notiz text not null default '',
  archiviert boolean not null default false,
  erstellt_am timestamptz not null default now()
);
create index bewerbungen_status_idx on bewerbungen(status);
create index bewerbungen_archiviert_idx on bewerbungen(archiviert);

-- ---------------------------------------------------------------------
-- KVAs (Phasen inkl. Zeilen als JSONB)
-- ---------------------------------------------------------------------
create table kvas (
  id bigint generated always as identity primary key,
  projekt_id bigint not null references projekte(id) on delete cascade,
  ratecard_id bigint not null references ratecards(id),
  bezeichnung text not null default '',
  phasen jsonb not null default '[]'::jsonb,
  erstellt_am timestamptz not null default now()
);
create index kvas_projekt_id_idx on kvas(projekt_id);

-- ---------------------------------------------------------------------
-- Rechnungen (Positionen als JSONB)
-- ---------------------------------------------------------------------
create table rechnungen (
  id bigint generated always as identity primary key,
  projekt_id bigint not null references projekte(id),
  rechnungsnummer text not null unique,
  rechnungsanschrift text not null default '',
  lieferanschrift text not null default '',
  empfaenger_name text not null default '',
  empfaenger_strasse text not null default '',
  empfaenger_plz text not null default '',
  empfaenger_ort text not null default '',
  empfaenger_land text not null default 'DE',
  leitweg_id text not null default '',
  leistungszeitraum_von date,
  leistungszeitraum_bis date,
  positionen jsonb not null default '[]'::jsonb,
  ust_satz numeric not null default 19,
  faelligkeitsdatum date,
  zahlungsstatus text not null default 'offen'
    check (zahlungsstatus in ('offen', 'bezahlt', 'ueberfaellig')),
  erstellt_am timestamptz not null default now()
);
create index rechnungen_projekt_id_idx on rechnungen(projekt_id);
create index rechnungen_zahlungsstatus_idx on rechnungen(zahlungsstatus);

-- ---------------------------------------------------------------------
-- Deadlines
-- ---------------------------------------------------------------------
create table deadlines (
  id bigint generated always as identity primary key,
  bezug_typ text check (bezug_typ in ('bewerbung', 'projekt', 'kva', 'rechnung')),
  bezug_id bigint,
  bezeichnung text not null,
  faelligkeitsdatum date not null,
  erledigt boolean not null default false
);
create index deadlines_faelligkeitsdatum_idx on deadlines(faelligkeitsdatum);
create index deadlines_erledigt_idx on deadlines(erledigt);

-- ---------------------------------------------------------------------
-- To-Dos
-- ---------------------------------------------------------------------
create table todos (
  id bigint generated always as identity primary key,
  text text not null,
  erledigt boolean not null default false,
  erstellt_am timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Google-Kalender-Sync-Zuordnung
-- ---------------------------------------------------------------------
create table calendar_sync_map (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('deadline', 'rechnung', 'projekt', 'kva', 'bewerbung')),
  entity_id bigint not null,
  google_event_id text not null,
  signature text not null,
  synced_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

-- =======================================================================
-- Row Level Security: Einzelnutzer-App, jeder authentifizierte Nutzer hat
-- vollen Zugriff. Self-Signup wird in den Auth-Einstellungen deaktiviert,
-- sodass effektiv nur der eine manuell angelegte Account existiert.
-- =======================================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'stammdaten', 'agenturen', 'ratecards', 'kunden', 'projekte',
      'bewerbungen', 'kvas', 'rechnungen', 'deadlines', 'todos',
      'calendar_sync_map'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all to authenticated using (true) with check (true);',
      t || '_authenticated_full_access', t
    );
  end loop;
end $$;

-- Initialer Stammdaten-Datensatz (Singleton), damit die App beim ersten
-- Laden nicht selbst einen anlegen muss.
insert into stammdaten (id) values (1) on conflict (id) do nothing;
