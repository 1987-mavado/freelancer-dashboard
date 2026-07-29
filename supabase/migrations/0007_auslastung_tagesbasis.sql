-- Auslastungs-Warner läuft jetzt mit festen Tages-Schwellen (8h normal,
-- >10h Gelb, >12h Rot) statt einer einstellbaren Wochenkapazität. Die alte
-- Spalte wird nicht mehr benötigt.
alter table stammdaten drop column if exists wochenkapazitaet_stunden;
