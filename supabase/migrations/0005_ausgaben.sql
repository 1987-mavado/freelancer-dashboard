-- Ausgaben-Erfassung: Betriebsausgaben mit fester Kategorie, Betrag, Datum,
-- Beschreibung und optionalem Beleg-Upload (Foto/PDF). Ergänzt die
-- Jahresübersicht (0004 lieferte bisher nur Einnahmen aus Rechnungen) um die
-- Ausgabenseite, für eine vollständigere EÜR-ähnliche Übersicht.

create table ausgaben (
  id bigint generated always as identity primary key,
  datum date not null default current_date,
  kategorie text not null default 'sonstiges',
  betrag numeric not null default 0,
  beschreibung text not null default '',
  beleg_url text not null default '',
  erstellt_am timestamptz not null default now()
);
create index ausgaben_datum_idx on ausgaben(datum);

alter table ausgaben enable row level security;
create policy ausgaben_authenticated_full_access on ausgaben
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- Storage-Bucket für Beleg-Uploads (Fotos/PDFs), analog zum "logos"-Bucket
-- aus 0002_rechnungen_erweiterungen.sql.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('belege', 'belege', true)
on conflict (id) do nothing;

-- Einzelnutzer-App: authentifizierter Nutzer darf im Bucket "belege" lesen/
-- schreiben/löschen (Lesezugriff ist durch den public-Bucket ohnehin offen,
-- die Policy hier deckt vor allem den Upload/Ersetzen/Löschen ab).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'belege_authenticated_full_access'
  ) then
    create policy belege_authenticated_full_access on storage.objects
      for all to authenticated
      using (bucket_id = 'belege')
      with check (bucket_id = 'belege');
  end if;
end $$;
