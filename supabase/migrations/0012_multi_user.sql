-- Multi-User-Fähigkeit: jede Zeile bekommt eine user_id, RLS trennt die
-- Daten strikt pro Account. WICHTIG: Diese Migration geht davon aus, dass
-- aktuell genau ein Account in auth.users existiert (deiner) — alle
-- bestehenden Daten werden diesem einen Account zugeordnet. Führe diese
-- Migration daher aus, BEVOR sich ein zweiter Account registriert.

-- ---------------------------------------------------------------------
-- 1. user_id-Spalte auf allen Tabellen ergänzen (zunächst nullable, damit
--    das Backfill für bestehende Zeilen funktioniert).
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'stammdaten', 'agenturen', 'ratecards', 'kunden', 'projekte',
      'bewerbungen', 'kvas', 'rechnungen', 'deadlines', 'todos',
      'calendar_sync_map', 'zeiteintraege', 'ausgaben'
    ])
  loop
    execute format(
      'alter table %I add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Backfill: bestehende Zeilen dem einzigen aktuell existierenden Account
--    zuordnen.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  first_user uuid;
begin
  select id into first_user from auth.users order by created_at asc limit 1;
  if first_user is null then
    raise notice 'Kein bestehender Account gefunden — Backfill übersprungen.';
    return;
  end if;
  for t in
    select unnest(array[
      'stammdaten', 'agenturen', 'ratecards', 'kunden', 'projekte',
      'bewerbungen', 'kvas', 'rechnungen', 'deadlines', 'todos',
      'calendar_sync_map', 'zeiteintraege', 'ausgaben'
    ])
  loop
    execute format('update %I set user_id = $1 where user_id is null;', t) using first_user;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. user_id verpflichtend machen.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'stammdaten', 'agenturen', 'ratecards', 'kunden', 'projekte',
      'bewerbungen', 'kvas', 'rechnungen', 'deadlines', 'todos',
      'calendar_sync_map', 'zeiteintraege', 'ausgaben'
    ])
  loop
    execute format('alter table %I alter column user_id set not null;', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3b. Der "nur ein laufender Timer"-Unique-Index war bisher global (ein
--     einziger laufender Timer für die ganze Tabelle) — muss jetzt pro
--     Account gelten, sonst könnte user_id B keinen Timer starten, solange
--     user_id A einen laufen hat.
-- ---------------------------------------------------------------------
drop index if exists zeiteintraege_only_one_running_idx;
create unique index zeiteintraege_only_one_running_idx on zeiteintraege(user_id) where laeuft;

-- ---------------------------------------------------------------------
-- 4. Stammdaten: kein festes Singleton (id=1) mehr, stattdessen eine Zeile
--    pro Account (eindeutig über user_id).
-- ---------------------------------------------------------------------
alter table stammdaten drop constraint if exists stammdaten_id_check;
alter table stammdaten alter column id drop default;
alter table stammdaten alter column id add generated always as identity;
-- Die neue Identity-Sequenz startet sonst wieder bei 1 und würde mit der
-- bereits bestehenden Zeile (id=1) kollidieren, sobald ein zweiter Account
-- eine eigene Stammdaten-Zeile anlegt.
select setval(pg_get_serial_sequence('stammdaten', 'id'), coalesce((select max(id) from stammdaten), 1));
alter table stammdaten add constraint stammdaten_user_id_key unique (user_id);

-- ---------------------------------------------------------------------
-- 4b. Weitere bisher globale Unique-Constraints müssen pro Account gelten
--     (zwei verschiedene Accounts dürfen z.B. beide "KUNDE-26-001" als
--     Rechnungsnummer verwenden).
-- ---------------------------------------------------------------------
alter table rechnungen drop constraint if exists rechnungen_rechnungsnummer_key;
alter table rechnungen add constraint rechnungen_user_id_rechnungsnummer_key unique (user_id, rechnungsnummer);

alter table calendar_sync_map drop constraint if exists calendar_sync_map_entity_type_entity_id_key;
alter table calendar_sync_map add constraint calendar_sync_map_user_id_entity_key unique (user_id, entity_type, entity_id);

-- ---------------------------------------------------------------------
-- 5. Alte "jeder authentifizierte Nutzer sieht alles"-Policies durch
--    "nur eigene Zeilen"-Policies ersetzen.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'stammdaten', 'agenturen', 'ratecards', 'kunden', 'projekte',
      'bewerbungen', 'kvas', 'rechnungen', 'deadlines', 'todos',
      'calendar_sync_map', 'zeiteintraege', 'ausgaben'
    ])
  loop
    execute format('drop policy if exists %I on %I;', t || '_authenticated_full_access', t);
    execute format(
      'create policy %I on %I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t || '_own_rows', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Storage (Logos/Belege): neue Uploads werden vom Code unter
--    "<user_id>/dateiname" abgelegt und sind dadurch nur für den jeweiligen
--    Account sichtbar. Bereits bestehende Dateien (ohne Ordner-Präfix,
--    aus der Zeit vor Multi-User) bleiben für alle authentifizierten Nutzer
--    lesbar/schreibbar — sie lassen sich nicht rückwirkend automatisch
--    zuordnen. Falls das nicht gewünscht ist, bitte melden, dann räumen wir
--    das gezielt auf.
-- ---------------------------------------------------------------------
drop policy if exists logos_authenticated_full_access on storage.objects;
create policy logos_own_or_legacy on storage.objects
  for all to authenticated
  using (
    bucket_id = 'logos'
    and (cardinality(storage.foldername(name)) = 0 or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id = 'logos'
    and (cardinality(storage.foldername(name)) = 0 or (storage.foldername(name))[1] = auth.uid()::text)
  );

drop policy if exists belege_authenticated_full_access on storage.objects;
create policy belege_own_or_legacy on storage.objects
  for all to authenticated
  using (
    bucket_id = 'belege'
    and (cardinality(storage.foldername(name)) = 0 or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id = 'belege'
    and (cardinality(storage.foldername(name)) = 0 or (storage.foldername(name))[1] = auth.uid()::text)
  );
