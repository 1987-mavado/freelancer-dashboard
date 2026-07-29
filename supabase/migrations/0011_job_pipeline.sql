-- Job-Pipeline: KVA "angenommen" → Projekt-Status "ressourcenplanung" →
-- (nach Bestätigung der Stunden im Ressourcentool) "abgeschlossen".
alter table kvas add column if not exists status text not null default 'entwurf'
  check (status in ('entwurf', 'angenommen'));

-- Bestehende CHECK-Constraint auf projekte.status (aus 0001_init.sql) muss um
-- den neuen Zwischenstatus erweitert werden. Name dynamisch ermitteln statt
-- fest anzunehmen, damit die Migration robust gegenüber abweichenden
-- automatisch vergebenen Constraint-Namen ist.
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
  check (status in ('akquise', 'aktiv', 'ressourcenplanung', 'pausiert', 'abgeschlossen'));
