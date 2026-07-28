import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../db/useSupabaseQuery'
import { getStammdaten, putStammdaten } from '../db/repo'
import { supabase } from '../db/supabaseClient'
import type { Stammdaten as StammdatenType } from '../db/types'
import PageHeader from '../layout/PageHeader'
import { formatDate } from '../utils/format'
import type { SyncResult } from '../utils/googleCalendar/sync'

const emptyForm: StammdatenType = {
  id: 1,
  name: '',
  adresse: '',
  strasse: '',
  plz: '',
  ort: '',
  land: 'DE',
  website: '',
  telefon: '',
  email: '',
  steuernummer: '',
  ustIdNr: '',
  iban: '',
  bic: '',
  bank: '',
  zahlungsbedingungen: '',
  logoUrl: '',
  rechnungAbschlusstext: '',
  googleClientId: '',
  googleCalendarId: 'primary',
  googleLastSyncedAt: '',
}

export default function Stammdaten() {
  const stammdaten = useSupabaseQuery(['stammdaten'], () => getStammdaten(), [])
  const [form, setForm] = useState<StammdatenType>(emptyForm)
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncFailed, setSyncFailed] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)

  useEffect(() => {
    if (stammdaten) setForm({ ...emptyForm, ...stammdaten })
  }, [stammdaten])

  function set<K extends keyof StammdatenType>(key: K, value: StammdatenType[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSaved(false)
  }

  // Lädt das gewählte Bild in den öffentlichen Supabase-Storage-Bucket
  // "logos" hoch und speichert sofort die öffentliche URL in den Stammdaten
  // (nicht erst beim nächsten "Speichern"-Klick), damit das Logo nicht
  // verloren geht, falls der Nutzer die Seite vorher verlässt.
  async function handleLogoUpload(file: File) {
    setUploadingLogo(true)
    setLogoError(null)
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `logo-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, cacheControl: '3600' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      const next = { ...form, logoUrl: data.publicUrl }
      setForm(next)
      await putStammdaten(next)
      setSaved(true)
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleSave() {
    await putStammdaten(form)
    setSaved(true)
  }

  async function handleGoogleSync() {
    if (!form.googleClientId.trim()) {
      setSyncFailed('Bitte zuerst eine Google Client-ID eintragen und speichern.')
      return
    }
    await putStammdaten(form)
    setSyncing(true)
    setSyncFailed(null)
    setSyncResult(null)
    try {
      const { syncGoogleCalendar } = await import('../utils/googleCalendar/sync')
      const result = await syncGoogleCalendar(form.googleClientId, form.googleCalendarId.trim() || 'primary')
      setSyncResult(result)
      const next = { ...form, googleLastSyncedAt: new Date().toISOString() }
      await putStammdaten(next)
      setForm(next)
    } catch (err) {
      setSyncFailed(err instanceof Error ? err.message : String(err))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <PageHeader title="Stammdaten" back={false} />
      <div className="stack">
        <div>
          <label>Name</label>
          <input className="field" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label>Adresse</label>
          <textarea
            className="field"
            value={form.adresse}
            onChange={(e) => set('adresse', e.target.value)}
          />
        </div>
        <div className="row">
          <div>
            <label>Website</label>
            <input className="field" value={form.website} onChange={(e) => set('website', e.target.value)} />
          </div>
          <div>
            <label>Telefon</label>
            <input className="field" value={form.telefon} onChange={(e) => set('telefon', e.target.value)} />
          </div>
        </div>
        <div>
          <label>E-Mail</label>
          <input
            className="field"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>
        <div>
          <label>Steuernummer</label>
          <input
            className="field"
            value={form.steuernummer}
            onChange={(e) => set('steuernummer', e.target.value)}
          />
        </div>
        <div>
          <label>USt-IdNr.</label>
          <input
            className="field"
            value={form.ustIdNr}
            onChange={(e) => set('ustIdNr', e.target.value)}
            placeholder="z.B. DE123456789"
          />
        </div>

        <div className="section-title">Adresse (strukturiert, für XRechnung)</div>
        <p className="muted">Wird für die XRechnung-/ZUGFeRD-Erzeugung benötigt, unabhängig vom Freitextfeld oben.</p>
        <div>
          <label>Straße und Hausnummer</label>
          <input className="field" value={form.strasse} onChange={(e) => set('strasse', e.target.value)} />
        </div>
        <div className="row">
          <div>
            <label>PLZ</label>
            <input className="field" value={form.plz} onChange={(e) => set('plz', e.target.value)} />
          </div>
          <div>
            <label>Ort</label>
            <input className="field" value={form.ort} onChange={(e) => set('ort', e.target.value)} />
          </div>
        </div>
        <div>
          <label>Land (ISO-Code)</label>
          <input
            className="field"
            value={form.land}
            onChange={(e) => set('land', e.target.value.toUpperCase())}
            placeholder="DE"
            maxLength={2}
          />
        </div>
        <div className="section-title">Bankverbindung</div>
        <div>
          <label>IBAN</label>
          <input className="field" value={form.iban} onChange={(e) => set('iban', e.target.value)} />
        </div>
        <div className="row">
          <div>
            <label>BIC</label>
            <input className="field" value={form.bic} onChange={(e) => set('bic', e.target.value)} />
          </div>
          <div>
            <label>Bank</label>
            <input className="field" value={form.bank} onChange={(e) => set('bank', e.target.value)} />
          </div>
        </div>
        <div>
          <label>Zahlungsbedingungen</label>
          <input
            className="field"
            value={form.zahlungsbedingungen}
            onChange={(e) => set('zahlungsbedingungen', e.target.value)}
            placeholder="z.B. 14 Tage netto"
          />
        </div>

        <div className="section-title">Rechnungs-PDF</div>
        <div>
          <label>Logo</label>
          {form.logoUrl && (
            <div style={{ marginBottom: 'var(--s2)' }}>
              <img src={form.logoUrl} alt="Firmenlogo" style={{ maxHeight: 60, maxWidth: 200 }} />
            </div>
          )}
          <input
            className="field"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleLogoUpload(file)
            }}
            disabled={uploadingLogo}
          />
          {uploadingLogo && <p className="muted">Logo wird hochgeladen…</p>}
          {logoError && <p className="error">Fehler beim Hochladen: {logoError}</p>}
          <p className="muted">Erscheint oben links auf dem Rechnungs-PDF.</p>
        </div>
        <div>
          <label>Abschlusstext (Rechnungs-PDF)</label>
          <textarea
            className="field"
            value={form.rechnungAbschlusstext}
            onChange={(e) => set('rechnungAbschlusstext', e.target.value)}
            rows={4}
          />
        </div>

        <button className="btn full" onClick={handleSave}>
          {saved ? 'Gespeichert ✓' : 'Speichern'}
        </button>

        <div className="section-title">Google Kalender</div>
        <p className="muted">
          Synchronisiert einseitig (App → Kalender): offene Deadlines, unbezahlte Rechnungs-Fälligkeitsdaten,
          Projekt-Zeiträume und KVA-Erstelldaten. Erledigte/gelöschte Einträge werden im Kalender automatisch
          entfernt.
        </p>
        <div>
          <label>Google Client-ID</label>
          <input
            className="field"
            value={form.googleClientId}
            onChange={(e) => set('googleClientId', e.target.value)}
            placeholder="xxxxxxxxxx.apps.googleusercontent.com"
          />
        </div>
        <div>
          <label>Kalender-ID</label>
          <input
            className="field"
            value={form.googleCalendarId}
            onChange={(e) => set('googleCalendarId', e.target.value)}
            placeholder="primary"
          />
        </div>
        <p className="muted">
          Letzte Synchronisierung: {form.googleLastSyncedAt ? formatDate(form.googleLastSyncedAt) : 'noch nie'}
        </p>
        <button className="btn ghost full" onClick={handleGoogleSync} disabled={syncing}>
          {syncing ? 'Synchronisiere…' : 'Verbinden & synchronisieren'}
        </button>
        {syncResult && (
          <p className="muted">
            {syncResult.created} neu, {syncResult.updated} aktualisiert, {syncResult.deleted} entfernt,{' '}
            {syncResult.unchanged} unverändert.
            {syncResult.errors.length > 0 && ` ${syncResult.errors.length} Fehler: ${syncResult.errors.join('; ')}`}
          </p>
        )}
        {syncFailed && <p className="muted">Fehler: {syncFailed}</p>}

        <div className="section-title">Verwaltung</div>
        <div className="list">
          <Link to="/agenturen" className="list-item">
            <span className="list-title">Agenturen &amp; Ratecards</span>
            <span className="muted">›</span>
          </Link>
          <Link to="/kunden" className="list-item">
            <span className="list-title">Kunden</span>
            <span className="muted">›</span>
          </Link>
          <Link to="/projekte" className="list-item">
            <span className="list-title">Projekte</span>
            <span className="muted">›</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
