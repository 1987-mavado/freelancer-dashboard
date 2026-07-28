-- Erweiterungen für Rechnungen: Bestellnummer, Logo, Abschlusstext.
-- Siehe Anforderung "Rechnungen komplett" (Rechnungsnummern-Logik,
-- Inhalte & Darstellung, Workflow).

-- ---------------------------------------------------------------------
-- Bestellnummer (Purchase-Order-Nummer) je Rechnung
-- ---------------------------------------------------------------------
alter table rechnungen add column if not exists bestellnummer text not null default '';

-- ---------------------------------------------------------------------
-- Firmenlogo (URL in Supabase Storage) + Abschlusstext für Rechnungs-PDFs
-- ---------------------------------------------------------------------
alter table stammdaten add column if not exists logo_url text not null default '';
alter table stammdaten add column if not exists rechnung_abschlusstext text not null default
  'Vielen Dank für die gute Zusammenarbeit! Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer bis zum genannten Fälligkeitsdatum auf das unten angegebene Konto.';

-- ---------------------------------------------------------------------
-- Storage-Bucket für Logo-Uploads
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

-- Einzelnutzer-App: authentifizierter Nutzer darf im Bucket "logos" lesen/
-- schreiben/löschen (Lesezugriff ist durch den public-Bucket ohnehin offen,
-- die Policy hier deckt vor allem den Upload/Ersetzen/Löschen ab).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'logos_authenticated_full_access'
  ) then
    create policy logos_authenticated_full_access on storage.objects
      for all to authenticated
      using (bucket_id = 'logos')
      with check (bucket_id = 'logos');
  end if;
end $$;
