import { useState } from 'react'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { deadlinesRepo, bewerbungenRepo, projekteRepo, kvasRepo, rechnungenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import { formatDate, todayISO } from '../../utils/format'
import type { Deadline, DeadlineBezugTyp } from '../../db/types'
import { buildDeadlineTarget } from '../../utils/googleCalendar/eventBuilders'
import { trySyncSingleEvent } from '../../utils/googleCalendar/singleSync'

const emptyForm: Deadline = {
  bezeichnung: '',
  faelligkeitsdatum: todayISO(),
  erledigt: false,
  bezugTyp: null,
  bezugId: undefined,
}

export default function DeadlinesList() {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Deadline>(emptyForm)

  const deadlines = useSupabaseQuery(
    ['deadlines'],
    async () => {
      const rows = await deadlinesRepo.list()
      rows.sort((a, b) =>
        a.faelligkeitsdatum > b.faelligkeitsdatum ? 1 : a.faelligkeitsdatum < b.faelligkeitsdatum ? -1 : 0,
      )
      return rows
    },
    [],
  )

  const bewerbungen = useSupabaseQuery(['bewerbungen'], () => bewerbungenRepo.list(), [])
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const kvas = useSupabaseQuery(['kvas'], () => kvasRepo.list(), [])
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])

  function bezugOptions(typ: DeadlineBezugTyp) {
    switch (typ) {
      case 'bewerbung':
        return bewerbungen?.map((b) => ({ id: b.id!, label: `${b.firma} – ${b.rolle}` })) ?? []
      case 'projekt':
        return projekte?.map((p) => ({ id: p.id!, label: p.name })) ?? []
      case 'kva':
        return kvas?.map((k) => ({ id: k.id!, label: k.bezeichnung })) ?? []
      case 'rechnung':
        return rechnungen?.map((r) => ({ id: r.id!, label: r.rechnungsnummer })) ?? []
      default:
        return []
    }
  }

  function bezugLabel(d: Deadline) {
    if (!d.bezugTyp || !d.bezugId) return null
    const opt = bezugOptions(d.bezugTyp).find((o) => o.id === d.bezugId)
    return opt?.label
  }

  async function handleAdd() {
    if (!form.bezeichnung.trim()) return
    const newId = await deadlinesRepo.add(form)
    const created: Deadline = { ...form, id: newId }
    void trySyncSingleEvent(buildDeadlineTarget(created, bezugLabel(created) ?? undefined))
    setForm(emptyForm)
    setFormOpen(false)
  }

  async function toggleErledigt(d: Deadline) {
    await deadlinesRepo.update(d.id!, { erledigt: !d.erledigt })
  }

  async function handleDelete(id?: number) {
    if (!id) return
    await deadlinesRepo.remove(id)
  }

  const today = todayISO()

  return (
    <div>
      <PageHeader title="Deadlines" />

      {formOpen && (
        <div className="card stack">
          <div>
            <label>Bezeichnung</label>
            <input
              className="field"
              value={form.bezeichnung}
              onChange={(e) => setForm((f) => ({ ...f, bezeichnung: e.target.value }))}
            />
          </div>
          <div>
            <label>Fälligkeitsdatum</label>
            <input
              className="field"
              type="date"
              value={form.faelligkeitsdatum}
              onChange={(e) => setForm((f) => ({ ...f, faelligkeitsdatum: e.target.value }))}
            />
          </div>
          <div>
            <label>Bezug (optional)</label>
            <select
              className="field"
              value={form.bezugTyp ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  bezugTyp: (e.target.value || null) as DeadlineBezugTyp,
                  bezugId: undefined,
                }))
              }
            >
              <option value="">Kein Bezug</option>
              <option value="bewerbung">Bewerbung</option>
              <option value="projekt">Projekt</option>
              <option value="kva">KVA</option>
              <option value="rechnung">Rechnung</option>
            </select>
          </div>
          {form.bezugTyp && (
            <div>
              <label>Verknüpfter Eintrag</label>
              <select
                className="field"
                value={form.bezugId ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, bezugId: Number(e.target.value) }))}
              >
                <option value="">– auswählen –</option>
                {bezugOptions(form.bezugTyp).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="muted">Wird bei Google Kalender verbunden automatisch als Eintrag angelegt.</p>
          <div className="row">
            <button className="btn ghost" onClick={() => setFormOpen(false)}>
              Abbrechen
            </button>
            <button className="btn" onClick={handleAdd}>
              Anlegen
            </button>
          </div>
        </div>
      )}

      <div className="list">
        {deadlines?.map((d) => (
          <div key={d.id} className="list-item" style={{ cursor: 'default' }}>
            <div className="checkbox-row">
              <input type="checkbox" checked={d.erledigt} onChange={() => toggleErledigt(d)} />
              <div>
                <div className={`list-title ${d.erledigt ? 'strikethrough' : ''}`}>{d.bezeichnung}</div>
                <div className="list-sub">
                  {formatDate(d.faelligkeitsdatum)}
                  {d.faelligkeitsdatum < today && !d.erledigt ? ' · überfällig' : ''}
                  {bezugLabel(d) ? ` · ${bezugLabel(d)}` : ''}
                </div>
              </div>
            </div>
            <button className="icon-btn" onClick={() => handleDelete(d.id)} aria-label="Löschen">
              ✕
            </button>
          </div>
        ))}
        {deadlines?.length === 0 && <div className="empty">Keine Deadlines angelegt.</div>}
      </div>

      {!formOpen && (
        <button className="fab" onClick={() => setFormOpen(true)} aria-label="Deadline hinzufügen">
          +
        </button>
      )}
    </div>
  )
}
