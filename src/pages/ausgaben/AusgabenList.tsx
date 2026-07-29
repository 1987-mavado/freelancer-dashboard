import { useState } from 'react'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { ausgabenRepo } from '../../db/repo'
import { supabase } from '../../db/supabaseClient'
import PageHeader from '../../layout/PageHeader'
import { formatEuro, formatDate, todayISO } from '../../utils/format'
import type { Ausgabe, AusgabeKategorie, BewirtungAnlass } from '../../db/types'

const kategorieLabel: Record<AusgabeKategorie, string> = {
  software: 'Software',
  buero_material: 'Büro & Material',
  reisekosten: 'Reisekosten',
  marketing: 'Marketing',
  bewirtung: 'Bewirtung/Geschäftsessen',
  sonstiges: 'Sonstiges',
}

const kategorien = Object.keys(kategorieLabel) as AusgabeKategorie[]

const anlassLabel: Record<BewirtungAnlass, string> = {
  bewerbung: 'Bewerbungsgespräch',
  kundenakquise: 'Kundenakquise',
  sonstiges: 'Sonstiges',
}

function emptyForm(): Ausgabe {
  return {
    datum: todayISO(),
    kategorie: 'sonstiges',
    betrag: 0,
    beschreibung: '',
    belegUrl: '',
    bewirtungTeilnehmer: '',
    bewirtungLokal: '',
    bewirtungAnlass: '',
    erstelltAm: new Date().toISOString(),
  }
}

export default function AusgabenList() {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Ausgabe>(emptyForm())
  const [belegFile, setBelegFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const ausgaben = useSupabaseQuery(
    ['ausgaben'],
    async () => {
      const rows = await ausgabenRepo.list()
      rows.sort((a, b) => (a.datum > b.datum ? -1 : a.datum < b.datum ? 1 : 0))
      return rows
    },
    [],
  )

  async function handleAdd() {
    if (!form.betrag || form.betrag <= 0) return
    setUploadError(null)
    let belegUrl = ''
    if (belegFile) {
      setUploading(true)
      try {
        const ext = belegFile.name.split('.').pop() || 'pdf'
        const path = `beleg-${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('belege')
          .upload(path, belegFile, { upsert: true, cacheControl: '3600' })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('belege').getPublicUrl(path)
        belegUrl = data.publicUrl
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err))
        setUploading(false)
        return
      }
      setUploading(false)
    }
    await ausgabenRepo.add({ ...form, belegUrl, erstelltAm: new Date().toISOString() })
    setForm(emptyForm())
    setBelegFile(null)
    setFormOpen(false)
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm('Ausgabe wirklich löschen?')) return
    await ausgabenRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="Ausgaben" />

      {formOpen && (
        <div className="card stack">
          <div className="row">
            <div>
              <label>Datum</label>
              <input
                className="field"
                type="date"
                value={form.datum}
                onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
              />
            </div>
            <div>
              <label>Betrag (€)</label>
              <input
                className="field"
                type="number"
                min="0"
                step="0.01"
                value={form.betrag || ''}
                onChange={(e) => setForm((f) => ({ ...f, betrag: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <label>Kategorie</label>
            <select
              className="field"
              value={form.kategorie}
              onChange={(e) => setForm((f) => ({ ...f, kategorie: e.target.value as AusgabeKategorie }))}
            >
              {kategorien.map((k) => (
                <option key={k} value={k}>
                  {kategorieLabel[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Beschreibung</label>
            <input
              className="field"
              value={form.beschreibung}
              onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
              placeholder="z.B. Adobe Creative Cloud Abo"
            />
          </div>

          {form.kategorie === 'bewirtung' && (
            <>
              <p className="muted">
                Für Bewirtungsbelege verlangt das Finanzamt diese Angaben zusätzlich zum Beleg.
              </p>
              <div>
                <label>Teilnehmer (vollständige Namen)</label>
                <input
                  className="field"
                  value={form.bewirtungTeilnehmer}
                  onChange={(e) => setForm((f) => ({ ...f, bewirtungTeilnehmer: e.target.value }))}
                  placeholder="z.B. Max Mustermann (Firma XY), ich selbst"
                />
              </div>
              <div>
                <label>Lokal (Name &amp; Adresse)</label>
                <input
                  className="field"
                  value={form.bewirtungLokal}
                  onChange={(e) => setForm((f) => ({ ...f, bewirtungLokal: e.target.value }))}
                  placeholder="z.B. Ristorante Roma, Musterstraße 1, 80333 München"
                />
              </div>
              <div>
                <label>Anlass</label>
                <select
                  className="field"
                  value={form.bewirtungAnlass}
                  onChange={(e) => setForm((f) => ({ ...f, bewirtungAnlass: e.target.value as BewirtungAnlass | '' }))}
                >
                  <option value="">– auswählen –</option>
                  {(Object.keys(anlassLabel) as BewirtungAnlass[]).map((a) => (
                    <option key={a} value={a}>
                      {anlassLabel[a]}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label>Beleg (Foto/PDF, optional)</label>
            <div className="row">
              <input
                id="beleg-kamera"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setBelegFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <label htmlFor="beleg-kamera" className="btn ghost full" style={{ textAlign: 'center', margin: 0 }}>
                📷 Foto aufnehmen
              </label>
              <input
                id="beleg-datei"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setBelegFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
                style={{ display: 'none' }}
              />
              <label htmlFor="beleg-datei" className="btn ghost full" style={{ textAlign: 'center', margin: 0 }}>
                Datei auswählen
              </label>
            </div>
            {belegFile && <p className="muted">Ausgewählt: {belegFile.name}</p>}
            {uploadError && <p className="error">Fehler beim Hochladen: {uploadError}</p>}
          </div>
          <div className="row">
            <button
              className="btn ghost"
              onClick={() => {
                setFormOpen(false)
                setForm(emptyForm())
                setBelegFile(null)
                setUploadError(null)
              }}
            >
              Abbrechen
            </button>
            <button className="btn" onClick={handleAdd} disabled={uploading}>
              {uploading ? 'Lädt hoch…' : 'Anlegen'}
            </button>
          </div>
        </div>
      )}

      <div className="list">
        {ausgaben?.map((a) => (
          <div key={a.id} className="list-item" style={{ cursor: 'default' }}>
            <div>
              <div className="list-title">
                {a.beschreibung || kategorieLabel[a.kategorie]} · {formatEuro(a.betrag)}
              </div>
              <div className="list-sub">
                {formatDate(a.datum)} · {kategorieLabel[a.kategorie]}
                {a.belegUrl && (
                  <>
                    {' · '}
                    <a href={a.belegUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      Beleg ansehen
                    </a>
                  </>
                )}
              </div>
              {a.kategorie === 'bewirtung' && (a.bewirtungTeilnehmer || a.bewirtungLokal || a.bewirtungAnlass) && (
                <div className="list-sub">
                  {a.bewirtungTeilnehmer && `Mit: ${a.bewirtungTeilnehmer}`}
                  {a.bewirtungLokal && ` · ${a.bewirtungLokal}`}
                  {a.bewirtungAnlass && ` · ${anlassLabel[a.bewirtungAnlass]}`}
                </div>
              )}
            </div>
            <button className="icon-btn" onClick={() => handleDelete(a.id)} aria-label="Löschen">
              ✕
            </button>
          </div>
        ))}
        {ausgaben?.length === 0 && <div className="empty">Noch keine Ausgaben erfasst.</div>}
      </div>

      {!formOpen && (
        <button className="fab" onClick={() => setFormOpen(true)} aria-label="Ausgabe hinzufügen">
          +
        </button>
      )}
    </div>
  )
}
