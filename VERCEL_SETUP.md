# Vercel-Hosting (einmalig, manuell)

Auch das kann ich nicht automatisieren (Account/Projekt-Erstellung, Domain-
Verknüpfung). Der Code ist bereits vorbereitet (`vercel.json` regelt das
Client-Side-Routing von React Router; die App liest `VITE_SUPABASE_URL` und
`VITE_SUPABASE_ANON_KEY` zur Build-Zeit aus den Umgebungsvariablen).

## 1. Projekt importieren

1. [vercel.com](https://vercel.com) → einloggen (z. B. mit GitHub).
2. **Add New → Project**.
3. Da dieses Projekt aktuell **kein Git-Repository** ist, gibt es zwei
   Wege:
   - **Empfohlen:** lokal `git init`, ein Repo z. B. auf GitHub anlegen,
     pushen, dann in Vercel dieses Repo importieren (automatische Deploys
     bei jedem Push).
   - Alternativ: `npx vercel` im Projektordner ausführen (Vercel CLI fragt
     Login + Projekt-Name ab und deployt direkt von der Festplatte, ohne
     Git — für spätere Updates dann jeweils erneut `npx vercel --prod`).
4. Framework Preset: Vercel erkennt **Vite** automatisch. Build-Command
   (`npm run build`) und Output-Directory (`dist`) sind zusätzlich explizit
   in `vercel.json` hinterlegt, falls die Auto-Erkennung mal danebenliegt.

## 2. Umgebungsvariablen setzen

**Project Settings → Environment Variables**, für **Production** (und
optional Preview/Development) jeweils anlegen:

- `VITE_SUPABASE_URL` = Project URL aus Supabase (siehe `SUPABASE_SETUP.md`)
- `VITE_SUPABASE_ANON_KEY` = anon public Key aus Supabase

Wichtig: Vite bettet diese Werte **zur Build-Zeit** in den JS-Bundle ein —
nach dem erstmaligen Setzen (oder Ändern) der Variablen muss einmal neu
deployt werden (Redeploy-Button in Vercel reicht, kein neuer Code nötig).

## 3. Google-Kalender-Login (OAuth) für die Produktions-Domain freischalten

Falls die Google-Kalender-Anbindung (Stammdaten → Client-ID) genutzt wird:
in der [Google Cloud Console](https://console.cloud.google.com) beim
verwendeten OAuth-Client unter **Authorized JavaScript origins** die
Vercel-Produktions-URL ergänzen (z. B. `https://freelance-dashboard.vercel.app`
bzw. eine eigene Domain), sonst schlägt der Google-Login dort mit einem
`origin_mismatch`-Fehler fehl. Lokal (`localhost:5173` o. ä.) bleibt davon
unberührt.

## 4. Deploy prüfen

Nach dem ersten Deploy: URL öffnen, mit dem in Supabase angelegten Account
einloggen (siehe `SUPABASE_SETUP.md`, Schritt 3), kurz durch ein, zwei
Seiten klicken. Die App sollte sich zusätzlich auf dem Smartphone über
"Zum Home-Bildschirm hinzufügen" (PWA) installieren lassen.

---

Sobald ein Vercel-Projekt existiert und die beiden Umgebungsvariablen
gesetzt sind, ist die Migration vollständig produktiv nutzbar.
