-- "Done"-Redesign: Ressourcentool entfällt zugunsten eines direkten Flows
-- (KVA annehmen → Projekt direkt "aktiv" + Jobnummer, statt über einen
-- Zwischenstatus "ressourcenplanung").

-- 1. KVA-Status um "gesendet"/"abgelehnt" erweitern. Name der bestehenden
--    Constraint dynamisch ermitteln statt fest anzunehmen.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'kvas'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table kvas drop constraint %I', con.conname);
  end loop;
end $$;

alter table kvas add constraint kvas_status_check
  check (status in ('entwurf', 'gesendet', 'angenommen', 'abgelehnt'));

-- 2. Projekte: bestehende Projekte mit Status "ressourcenplanung" auf
--    "aktiv" ummappen, dann den Status wieder aus dem Constraint entfernen.
update projekte set status = 'aktiv' where status = 'ressourcenplanung';

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'projekte'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table projekte drop constraint %I', con.conname);
  end loop;
end $$;

alter table projekte add constraint projekte_status_check
  check (status in ('akquise', 'aktiv', 'pausiert', 'abgeschlossen'));

-- 3. Ressourcenplanungs-Kalender-Tabelle entfernen (Planungskalender ist
--    durch den direkten Zeiterfassungs-Flow ersetzt).
drop table if exists ressourcenplan;
