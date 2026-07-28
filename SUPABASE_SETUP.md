# Supabase-Setup (einmalig, manuell)

Diese Schritte kann nur du selbst ausführen (Account-Erstellung, keine
CLI-Automatisierung möglich). Danach brauche ich zwei Werte von dir zurück,
siehe ganz unten.

## 1. Neue Organisation + Projekt anlegen

1. [supabase.com](https://supabase.com) → einloggen.
2. **Wichtig:** oben links eine **neue Organisation** anlegen (nicht das
   bestehende "1987-mavado's Org" verwenden, da dort Nonna im Pro-Tarif
   läuft — ein zusätzliches Projekt dort würde ca. 10 $/Monat extra kosten).
   Name z. B. "Freelance-Dashboard". Plan: **Free**.
3. Innerhalb der neuen Organisation ein neues Projekt anlegen (Name z. B.
   `freelance-dashboard`, Region z. B. Frankfurt `eu-central-1`, ein
   Datenbank-Passwort setzen — das brauchst du nur, falls du dich mal direkt
   per `psql` verbindest, für die App selbst nicht relevant).
4. Warten, bis das Projekt fertig provisioniert ist (paar Minuten).

## 2. Schema anlegen

1. Im Projekt links **SQL Editor** öffnen.
2. Den kompletten Inhalt von `supabase/migrations/0001_init.sql` (liegt im
   Projektordner) hineinkopieren und **Run** klicken.
3. Kurzer Check: unter **Table Editor** sollten jetzt 11 Tabellen auftauchen
   (stammdaten, agenturen, ratecards, kunden, projekte, bewerbungen, kvas,
   rechnungen, deadlines, todos, calendar_sync_map).

## 3. Auth konfigurieren (ein Account, kein Self-Signup)

1. **Authentication → Providers → Email**: aktiviert lassen.
2. **Authentication → Settings** (bzw. "Sign In / Providers" je nach
   Supabase-Version): **"Allow new users to sign up" deaktivieren** — das
   verhindert, dass sich jemand anderes selbst registrieren kann.
3. **Authentication → Users → Add user → Create new user**: deine E-Mail und
   ein Passwort eintragen, **"Auto Confirm User" aktivieren** (damit keine
   Bestätigungs-Mail nötig ist). Das ist der einzige Account, mit dem du dich
   später in der App einloggst.

## 4. API-Zugangsdaten holen

**Project Settings → API**. Dort zwei Werte kopieren:

- **Project URL** (z. B. `https://abcdefgh.supabase.co`)
- **anon public** Key (langer JWT-String, beginnt mit `eyJ...`)

Diesen (öffentlichen, für den Client bestimmten) Key **nicht** mit dem
`service_role`-Key verwechseln — letzteren niemals in die Frontend-App
einbauen.

## 5. Werte an mich zurückgeben

Schick mir **Project URL** und **anon public Key** — ich trage sie in eine
`.env`-Datei ein (die nicht committet wird) und schließe die Migration ab.

---

Sobald diese fünf Schritte erledigt sind, kann ich mit der eigentlichen
Code-Migration (Auth-Login, Datenzugriffsschicht) weitermachen bzw. sie
gegen dein echtes Projekt testen. Ich baue in der Zwischenzeit bereits den
Code vor, der dann nur noch die Zugangsdaten braucht.
