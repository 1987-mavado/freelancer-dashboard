import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { agenturenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'

export default function AgenturenList() {
  const agenturen = useSupabaseQuery(
    ['agenturen'],
    async () => {
      const rows = await agenturenRepo.list()
      rows.sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0))
      return rows
    },
    [],
  )

  return (
    <div>
      <PageHeader title="Agenturen" />
      <div className="list">
        {agenturen?.map((a) => (
          <Link key={a.id} to={`/agenturen/${a.id}`} className="list-item">
            <div>
              <div className="list-title">{a.name}</div>
              {a.kontaktpersonen && <div className="list-sub">{a.kontaktpersonen}</div>}
            </div>
            <span className="muted">›</span>
          </Link>
        ))}
        {agenturen?.length === 0 && <div className="empty">Noch keine Agenturen angelegt.</div>}
      </div>
      <Link to="/agenturen/neu" className="fab" aria-label="Agentur hinzufügen">
        +
      </Link>
    </div>
  )
}
