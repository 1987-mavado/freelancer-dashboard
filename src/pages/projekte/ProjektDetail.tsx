import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { projekteRepo, kundenRepo, agenturenRepo } from '../../db/repo'
import type { Projekt } from '../../db/types'
import PageHeader from '../../layout/PageHeader'

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

  const [form, setForm] = useState<Projekt>(emptyForm)

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  async function handleSave() {
    if (!form.name.trim() || !form.kundeId) return
    if (isNew) {
      const newId = await projekteRepo.add(form)
      navigate(`/projekte/${newId}`, { replace: true })
    } else {
      await projekteRepo.update(projektId!, form)
      navigate('/projekte')
    }
  }

  async function handleDelete() {
    if (!projektId) return
    if (!confirm('Projekt wirklich löschen? Verknüpfte KVAs und Rechnungen bleiben bestehen.')) return
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
