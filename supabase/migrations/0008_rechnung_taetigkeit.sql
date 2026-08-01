-- Neues Feld "Tätigkeit" für die Rechnungs-Überschrift
-- "Rechnung – Nr – Kunde – Tätigkeit".
alter table rechnungen add column if not exists taetigkeit text not null default '';

-- Fester Abschlusstext exakt nach Vorgabe (überschreibt den bisherigen
-- Standardtext in den Stammdaten). Bewusst ohne Namenszeile am Ende — die
-- Grußformel-Unterschrift ergibt sich aus dem individuell hinterlegten
-- Namen in den Stammdaten, nicht aus einem hartcodierten Wert hier.
update stammdaten
set rechnung_abschlusstext = E'Vielen Dank für die Zusammenarbeit.\nTerms of payment: Payment is due 14 days after receipt of invoice.\nBitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer auf das unten angegebene Konto.\nDer Rechnungsbetrag ist bis 14 Tage nach Rechnungseingang fällig.\nMit freundlichen Grüßen'
where id = 1;
