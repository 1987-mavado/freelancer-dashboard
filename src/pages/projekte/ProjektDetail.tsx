import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { projekteRepo, kundenRepo, agenturenRepo, deadlinesRepo } from '../../db/repo'
import type { Projekt } from '../../db/types'
import PageHeader from '../../layout/PageHeader'
import { ensureRechnungFuerAbgeschlossenesProjekt } from '../../utils/rechnung'
import { buildDeadlineTarget } from '../../utils/googleCalendar/eventBuilders'
import { trySyncSingleEvent } from '../../utils/googleCalendar/singleSync'

const emptyForm: Projekt = {
  kundeId: 0,
  agenturId: undefined,
  name: '',
  nummer: '',
  status: 'akquise',
  von: '',
  bis: '',
}

export default function ProjektDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'neu'
  const projektId = isNew ? undefined : Number(id)

  const existing = useSupabaseQuery(
    ['projekte'],
    () => (projektId ? projekteRepo.get(projektId) : Promise.resolve(undefined)),
    [projektId],
  )
  const kunden = useSupabaseQuery(
    ['kunden'],
    async () => {
      const rows = await kundenRepo.list()
      rows.sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0))
      return rows
    },
    [],
  )
  const agenturen = useSupabaseQuery(
    ['agenturen'],
    async () => {
      const rows = await agenturenRepo.list()
      rows.sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0))
      return rows
    },
    [],
  )

  // Individuelle Deadline pro Job/Projekt (Ersatz für die frühere
  // Homescreen-Deadline-Sektion, siehe Aktive-Projekte-Widget) — verlinkt
  // über die bestehende deadlines-Tabelle statt eines eigenen Feldes.
  const projektDeadline = useSupabaseQuery(
    ['deadlines'],
    async () => {
      if (!projektId) return undefined
      const alle = await deadlinesRepo.list()
      return alle.find((d) => d.bezugTyp === 'projekt' && d.bezugId === projektId)
    },
    [projektId],
  )

  const [form, setForm] = useState<Projekt>(emptyForm)
  const [deadlineDatum, setDeadlineDatum] = useState('')

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  useEffect(() => {
    setDeadlineDatum(projektDeadline?.faelligkeitsdatum ?? '')
  }, [projektDeadline])

  async function handleDeadlineChange(datum: string) {
    setDeadlineDatum(datum)
    if (!projektId) return
    if (!datum) {
      if (projektDeadline?.id) await deadlinesRepo.remove(projektDeadline.id)
      return
    }
    if (projektDeadline?.id) {
      await deadlinesRepo.update(projektDeadline.id, { faelligkeitsdatum: datum })
      void trySyncSingleEvent(
        buildDeadlineTarget({ ...projektDeadline, faelligkeitsdatum: datum }, form.name),
      )
    } else {
      const neu = {
        bezugTyp: 'projekt' as const,
        bezugId: projektId,
        bezeichnung: `Deadline: ${form.name || 'Projekt'}`,
        faelligkeitsdatum: datum,
        erledigt: false,
      }
      const newId = await deadlinesRepo.add(neu)
      void trySyncSingleEvent(buildDeadlineTarget({ ...neu, id: newId }, form.name))
    }
  }

  async function handleSave() {
    if (!form.name.trim() || !form.kundeId) return
    const targetId = isNew ? await projekteRepo.add(form) : projektId!
    if (!isNew) await projekteRepo.update(targetId, form)

    // Wird der Status auf "abgeschlossen" gesetzt, automatisch eine leere
    // Rechnung anlegen (nur falls noch keine existiert) und direkt dorthin
    // weiterleiten, damit Adresse/Positionen sofort ergänzt werden können.
    if (form.status === 'abgeschlossen') {
      const neueRechnungId = await ensureRechnungFuerAbgeschlossenesProjekt(targetId)
      if (neueRechnungId) {
        navigate(`/rechnungen/${neueRechnungId}`, { replace: true })
        return
      }
    }

    if (isNew) {
      navigate(`/projekte/${targetId}`, { replace: true })
    } else {
      navigate('/projekte')
    }
  }

  async function handleDelete() {
    if (!projektId) return
    const frage =
      form.status !== 'akquise'
        ? 'Dieses Projekt ist bereits aktiv/abgeschlossen — wirklich löschen? (Verknüpfte KVAs und Rechnungen bleiben bestehen.)'
        : 'Projekt wirklich löschen?'
    if (!confirm(frage)) return
    await projekteRepo.remove(projektId)
    navigate('/projekte', { replace: true })
  }

  return (
    <div>
      <PageHeader title={isNew ? 'Neues Projekt' : 'Projekt bearbeiten'} />
      <div className="stack">
        <div>
          <label>Projektname</label>
          <input
            className="field"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="row">
          <div>
            <label>Projektnummer</label>
            <input
              className="field"
              value={form.nummer}
              onChange={(e) => setForm((f) => ({ ...f, nummer: e.target.value }))}
            />
          </div>
          <div>
            <label>Status</label>
            <select
              className="field"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Projekt['status'] }))}
            >
              <option value="akquise">Akquise</option>
              <option value="aktiv">Aktiv</option>
              <option value="pausiert">Pausiert</option>
              <option value="abgeschlossen">Abgeschlossen</option>
            </select>
          </div>
        </div>
        <div>
          <label>Kunde</label>
          <select
            className="field"
            value={form.kundeId || ''}
            onChange={(e) => setForm((f) => ({ ...f, kundeId: Number(e.target.value) }))}
          >
            <option value="">– auswählen –</option>
            {kunden?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Agentur (optional)</label>
          <select
            className="field"
            value={form.agenturId ?? ''}
            onChange={(e) =>
              setForm((f) => ({ ...f, agenturId: e.target.value ? Number(e.target.value) : undefined }))
            }
          >
            <option value="">Keine</option>
            {agenturen?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <div>
            <label>Zeitraum von</label>
            <input
              className="field"
              type="date"
              value={form.von ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, von: e.target.value }))}
            />
          </div>
          <div>
            <label>Zeitraum bis</label>
            <input
              className="field"
              type="date"
              value={form.bis ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, bis: e.target.value }))}
            />
          </div>
        </div>
        {!isNew && (
          <div>
            <label>Deadline (optional)</label>
            <input
              className="field"
              type="date"
              value={deadlineDatum}
              onChange={(e) => handleDeadlineChange(e.target.value)}
            />
            <p className="muted">Erscheint im Aktive-Projekte-Widget auf der Übersicht.</p>
          </div>
        )}
        <button className="btn full" onClick={handleSave}>
          Speichern
        </button>
        {!isNew && (
          <button className="btn ghost full" onClick={handleDelete}>
            Projekt löschen
          </button>
        )}
      </div>
    </div>
  )
}
