-- Zusatzfelder für die Kategorie "Bewirtung/Geschäftsessen": Teilnehmer,
-- Lokal (Name & Adresse) und Anlass. Diese Angaben werden vom Finanzamt für
-- Bewirtungsbelege verlangt (siehe Anforderung "Essensausgaben").
alter table ausgaben add column if not exists bewirtung_teilnehmer text not null default '';
alter table ausgaben add column if not exists bewirtung_lokal text not null default '';
alter table ausgaben add column if not exists bewirtung_anlass text not null default '';
