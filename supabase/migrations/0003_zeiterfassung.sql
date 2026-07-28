-- Zeiterfassung: Start/Stopp-Timer + manuelle Einträge, jeweils verknüpft
-- mit Projekt + Rolle (Rolle als reiner Text, analog zu ratecards.zeilen[].rolle
-- und kvas.phasen[].zeilen[].rolle — kein FK, da Rollen nur als String in den
-- Ratecard-Zeilen existieren). Einträge lassen sich später als Rechnungs-
-- positionen übernehmen (siehe "abgerechnet"/"rechnung_id").

create table zeiteintraege (
  id bigint generated always as identity primary key,
  projekt_id bigint not null references projekte(id) on delete cascade,
  rolle text not null default '',
  datum date not null default current_date,
  -- Solange der Timer läuft, steht hier der Startzeitpunkt und `laeuft` ist
  -- true; `dauer_minuten` ist dann noch 0 und wird beim Stoppen berechnet.
  -- Bei manuellen Einträgen bleibt `start_zeit` leer, `dauer_minuten` wird
  -- direkt eingegeben.
  start_zeit timestamptz,
  dauer_minuten integer not null default 0,
  laeuft boolean not null default false,
  beschreibung text not null default '',
  abgerechnet boolean not null default false,
  rechnung_id bigint references rechnungen(id) on delete set null,
  erstellt_am timestamptz not null default now()
);
create index zeiteintraege_projekt_id_idx on zeiteintraege(projekt_id);
create index zeiteintraege_abgerechnet_idx on zeiteintraege(abgerechnet);

-- Stellt sicher, dass global nie mehr als ein Timer gleichzeitig läuft (auch
-- bei mehreren offenen Tabs/Geräten) — ein zweiter Versuch, `laeuft = true`
-- zu setzen, scheitert an diesem Unique-Index.
create unique index zeiteintraege_only_one_running_idx on zeiteintraege(laeuft) where laeuft;

alter table zeiteintraege enable row level security;
create policy zeiteintraege_authenticated_full_access on zeiteintraege
  for all to authenticated using (true) with check (true);
