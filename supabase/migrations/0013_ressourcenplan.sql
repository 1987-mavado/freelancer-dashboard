-- Ressourcenplanungs-Kalender: geplante Personentage/-stunden je Projekt
-- und Rolle an einem Tag, unabhängig von der tatsächlichen Zeiterfassung.
create table ressourcenplan (
  id bigint generated always as identity primary key,
  projekt_id bigint not null references projekte(id) on delete cascade,
  rolle text not null default '',
  datum date not null default current_date,
  geplante_stunden numeric not null default 0,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  erstellt_am timestamptz not null default now()
);
create index ressourcenplan_projekt_id_idx on ressourcenplan(projekt_id);
create index ressourcenplan_datum_idx on ressourcenplan(datum);

alter table ressourcenplan enable row level security;
create policy ressourcenplan_own_rows on ressourcenplan
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
