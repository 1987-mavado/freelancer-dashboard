-- Beleg-Foto-Analyse: Aussteller/Adresse als generische Felder (bisher gab
-- es das nur für Bewirtung als "Lokal").
alter table ausgaben add column if not exists aussteller text not null default '';
alter table ausgaben add column if not exists aussteller_adresse text not null default '';
