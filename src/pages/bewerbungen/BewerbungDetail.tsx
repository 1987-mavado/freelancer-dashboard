import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { bewerbungenRepo } from '../../db/repo'
import type { Bewerbung, BewerbungKanal, BewerbungStatus } from '../../db/types'
import PageHeader from '../../layout/PageHeader'
import { buildBewerbungTarget } from '../../utils/googleCalendar/eventBuilders'
import { trySyncSingleEvent } from '../../utils/googleCalendar/singleSync'

const emptyForm: Bewerbung = {
  firma: '',
  rolle: '',
  kanal: undefined,
  ausschreibungstext: '',
  anschreiben: '',
  empfaengerEmail: '',
  status: 'anschreiben_raus',
  gespraechDatum: '',
  notiz: '',
  archiviert: false,
  erstelltAm: new Date().toISOString(),
}

const kanalLabel: Record<BewerbungKanal, string> = {
  linkedin_dm: 'LinkedIn DM',
  email: 'Persönliche E-Mail-Anfrage',
  linkedin_ausschreibung: 'LinkedIn Jobausschreibung',
}

export default function BewerbungDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'neu'
  const bewerbungId = isNew ? undefined : Number(id)

  const existing = useSupabaseQuery(
    ['bewerbungen'],
    () => (bewerbungId ? bewerbungenRepo.get(bewerbungId) : Promise.resolve(undefined)),
    [bewerbungId],
  )

  const [form, setForm] = useState<Bewerbung>(emptyForm)

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  async function handleSave() {
    if (!form.firma.trim() || !form.rolle.trim()) return
    if (isNew) {
      const newId = await bewerbungenRepo.add(form)
      void trySyncSingleEvent(buildBewerbungTarget({ ...form, id: newId }))
      navigate(`/bewerbungen/${newId}`, { replace: true })
    } else {
      await bewerbungenRepo.update(bewerbungId!, form)
      void trySyncSingleEvent(buildBewerbungTarget({ ...form, id: bewerbungId }))
      navigate('/bewerbungen')
    }
  }

  async function handleArchivieren() {
    if (!bewerbungId) return
    await bewerbungenRepo.update(bewerbungId, { archiviert: true })
    navigate('/bewerbungen', { replace: true })
  }

  async function handleDelete() {
    if (!bewerbungId) return
    if (!confirm('Bewerbung wirklich löschen?')) return
    await bewerbungenRepo.remove(bewerbungId)
    navigate('/bewerbungen', { replace: true })
  }

  return (
    <div>
      <PageHeader title={isNew ? 'Neue Bewerbung' : 'Bewerbung bearbeiten'} />
      <div className="stack">
        <div>
          <label>Firma / Agentur</label>
          <input
            className="field"
            value={form.firma}
            onChange={(e) => setForm((f) => ({ ...f, firma: e.target.value }))}
          />
        </div>
        <div>
          <label>Rolle</label>
          <input
            className="field"
            value={form.rolle}
            onChange={(e) => setForm((f) => ({ ...f, rolle: e.target.value }))}
          />
        </div>
        <div>
          <label>Kanal</label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(kanalLabel) as BewerbungKanal[]).map((k) => (
              <button
                key={k}
                type="button"
                className={`btn ${form.kanal === k ? '' : 'ghost'} small`}
                onClick={() => setForm((f) => ({ ...f, kanal: f.kanal === k ? undefined : k }))}
              >
                {kanalLabel[k]}
              </button>
            ))}
          </div>
        </div>
        {form.kanal === 'email' && (
          <div>
            <label>Empfänger-E-Mail</label>
            <input
              className="field"
              type="email"
              value={form.empfaengerEmail ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, empfaengerEmail: e.target.value }))}
            />
          </div>
        )}
        <div>
          <label>Ausschreibungstext</label>
          <textarea
            className="field"
            rows={4}
            value={form.ausschreibungstext ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, ausschreibungstext: e.target.value }))}
          />
        </div>
        <div>
          <label>Anschreiben</label>
          <textarea
            className="field"
            rows={6}
            value={form.anschreiben ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, anschreiben: e.target.value }))}
          />
        </div>
        <div>
          <label>Status</label>
          <div className="row">
            {(['anschreiben_raus', 'call', 'zusage'] as BewerbungStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`btn ${form.status === s ? '' : 'ghost'} small`}
                onClick={() => setForm((f) => ({ ...f, status: s }))}
              >
                {s === 'anschreiben_raus' ? 'Raus' : s === 'call' ? 'Call' : 'Zusage'}
              </button>
            ))}
          </div>
        </div>
        {form.status === 'call' && (
          <div>
            <label>Termin (Datum &amp; Uhrzeit)</label>
            <input
              className="field"
              type="datetime-local"
              value={form.gespraechDatum ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, gespraechDatum: e.target.value }))}
            />
            <p className="muted">Wird bei Google Kalender verbunden automatisch als Termin angelegt.</p>
          </div>
        )}
        <div>
          <label>Notiz</label>
          <textarea
            className="field"
            value={form.notiz ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))}
          />
        </div>
        <button className="btn full" onClick={handleSave}>
          Speichern
        </button>
        {!isNew && (
          <>
            <button className="btn ghost full" onClick={handleArchivieren}>
              Absage — archivieren
            </button>
            <button className="btn danger full" onClick={handleDelete}>
              Endgültig löschen
            </button>
          </>
        )}
      </div>
    </div>
  )
}
