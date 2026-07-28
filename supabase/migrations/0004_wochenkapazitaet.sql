-- Auslastungs-Warner: Wochenkapazität in Stunden, die der Nutzer in den
-- Stammdaten hinterlegt. Das Dashboard vergleicht damit die in der aktuellen
-- Kalenderwoche erfassten Zeiteinträge und warnt bei Überschreitung.
alter table stammdaten add column if not exists wochenkapazitaet_stunden numeric not null default 30;
