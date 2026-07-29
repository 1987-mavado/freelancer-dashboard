import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { agenturenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'

export default function AgenturenList() {
  const navigate = useNavigate()
  const agenturen = useSupabaseQuery(
    ['agenturen'],
    async () => {
      const rows = await agenturenRepo.list()
      rows.sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0))
      return rows
    },
    [],
  )

  async function handleDelete(e: React.MouseEvent, id?: number) {
    e.stopPropagation()
    if (!id) return
    if (!confirm('Agentur wirklich löschen? Verknüpfte Ratecards werden mitgelöscht.')) return
    await agenturenRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="Agenturen" />
      <div className="list">
        {agenturen?.map((a) => (
          <div key={a.id} className="list-item" onClick={() => navigate(`/agenturen/${a.id}`)}>
            <div>
              <div className="list-title">{a.name}</div>
              {a.kontaktpersonen && <div className="list-sub">{a.kontaktpersonen}</div>}
            </div>
            <button className="icon-btn" onClick={(e) => handleDelete(e, a.id)} aria-label="Löschen">
              ✕
            </button>
          </div>
        ))}
        {agenturen?.length === 0 && <div className="empty">Noch keine Agenturen angelegt.</div>}
      </div>
      <Link to="/agenturen/neu" className="fab" aria-label="Agentur hinzufügen">
        +
      </Link>
    </div>
  )
}
