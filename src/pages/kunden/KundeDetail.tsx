import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { kundenRepo, agenturenRepo } from '../../db/repo'
import type { Kunde } from '../../db/types'
import PageHeader from '../../layout/PageHeader'

export default function KundeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'neu'
  const kundeId = isNew ? undefined : Number(id)

  const existing = useSupabaseQuery(
    ['kunden'],
    () => (kundeId ? kundenRepo.get(kundeId) : Promise.resolve(undefined)),
    [kundeId],
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

  const [form, setForm] = useState<Kunde>({ name: '', agenturId: undefined })

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  async function handleSave() {
    if (!form.name.trim()) return
    if (isNew) {
      const newId = await kundenRepo.add(form)
      navigate(`/kunden/${newId}`, { replace: true })
    } else {
      await kundenRepo.update(kundeId!, form)
      navigate('/kunden')
    }
  }

  async function handleDelete() {
    if (!kundeId) return
    if (!confirm('Kunde wirklich löschen?')) return
    await kundenRepo.remove(kundeId)
    navigate('/kunden', { replace: true })
  }

  return (
    <div>
      <PageHeader title={isNew ? 'Neuer Kunde' : 'Kunde bearbeiten'} />
      <div className="stack">
        <div>
          <label>Name</label>
          <input
            className="field"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label>Agentur</label>
          <select
            className="field"
            value={form.agenturId ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                agenturId: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">Direktkunde (keine Agentur)</option>
            {agenturen?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn full" onClick={handleSave}>
          Speichern
        </button>
        {!isNew && (
          <button className="btn ghost full" onClick={handleDelete}>
            Kunde löschen
          </button>
        )}
      </div>
    </div>
  )
}
