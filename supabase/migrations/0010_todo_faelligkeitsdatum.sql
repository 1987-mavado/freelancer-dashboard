-- Optionales Fälligkeitsdatum für To-Dos, damit sie (wenn gesetzt) in den
-- Google-Kalender-Sync aufgenommen werden können.
alter table todos add column if not exists faelligkeitsdatum text not null default '';
