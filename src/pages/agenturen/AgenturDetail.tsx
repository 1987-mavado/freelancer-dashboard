import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { agenturenRepo, getRatecardsByAgentur, removeAgenturCascade } from '../../db/repo'
import type { Agentur } from '../../db/types'
import PageHeader from '../../layout/PageHeader'
import RatecardEditor from './RatecardEditor'

export default function AgenturDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'neu'
  const agenturId = isNew ? undefined : Number(id)

  const existing = useSupabaseQuery(
    ['agenturen'],
    () => (agenturId ? agenturenRepo.get(agenturId) : Promise.resolve(undefined)),
    [agenturId],
  )
  const ratecards = useSupabaseQuery(
    ['ratecards'],
    () => (agenturId ? getRatecardsByAgentur(agenturId) : Promise.resolve([])),
    [agenturId],
  )

  const [form, setForm] = useState<Agentur>({ name: '', kontaktpersonen: '' })

  useEffect(() => {
    if (existing) setForm(existing)
  }, [existing])

  async function handleSave() {
    if (!form.name.trim()) return
    if (isNew) {
      const newId = await agenturenRepo.add(form)
      navigate(`/agenturen/${newId}`, { replace: true })
    } else {
      await agenturenRepo.update(agenturId!, form)
    }
  }

  async function handleDelete() {
    if (!agenturId) return
    if (!confirm('Agentur wirklich löschen? Verknüpfte Ratecards werden mitgelöscht.')) return
    await removeAgenturCascade(agenturId)
    navigate('/agenturen', { replace: true })
  }

  return (
    <div>
      <PageHeader title={isNew ? 'Neue Agentur' : form.name || 'Agentur'} />
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
          <label>Kontaktperson(en)</label>
          <input
            className="field"
            value={form.kontaktpersonen}
            onChange={(e) => setForm((f) => ({ ...f, kontaktpersonen: e.target.value }))}
          />
        </div>
        <button className="btn full" onClick={handleSave}>
          Speichern
        </button>
        {!isNew && (
          <button className="btn ghost full" onClick={handleDelete}>
            Agentur löschen
          </button>
        )}
      </div>

      {!isNew && agenturId && (
        <>
          <div className="section-title">Ratecards</div>
          <RatecardEditor agenturId={agenturId} ratecards={ratecards ?? []} />
        </>
      )}
    </div>
  )
}
