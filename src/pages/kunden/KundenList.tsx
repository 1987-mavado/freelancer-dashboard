import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { kundenRepo, agenturenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'

export default function KundenList() {
  const kunden = useSupabaseQuery(
    ['kunden'],
    async () => {
      const rows = await kundenRepo.list()
      rows.sort((a, b) => (a.name > b.name ? 1 : a.name < b.name ? -1 : 0))
      return rows
    },
    [],
  )
  const agenturen = useSupabaseQuery(['agenturen'], () => agenturenRepo.list(), [])

  function agenturName(agenturId?: number) {
    if (!agenturId) return 'Direktkunde'
    return agenturen?.find((a) => a.id === agenturId)?.name ?? 'Direktkunde'
  }

  return (
    <div>
      <PageHeader title="Kunden" />
      <div className="list">
        {kunden?.map((k) => (
          <Link key={k.id} to={`/kunden/${k.id}`} className="list-item">
            <div>
              <div className="list-title">{k.name}</div>
              <div className="list-sub">{agenturName(k.agenturId)}</div>
            </div>
            <span className="muted">›</span>
          </Link>
        ))}
        {kunden?.length === 0 && <div className="empty">Noch keine Kunden angelegt.</div>}
      </div>
      <Link to="/kunden/neu" className="fab" aria-label="Kunde hinzufügen">
        +
      </Link>
    </div>
  )
}
