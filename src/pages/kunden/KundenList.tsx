import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { kundenRepo, agenturenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'

export default function KundenList() {
  const navigate = useNavigate()
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

  async function handleDelete(e: React.MouseEvent, id?: number) {
    e.stopPropagation()
    if (!id) return
    if (!confirm('Kunde wirklich löschen?')) return
    await kundenRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="Kunden" />
      <div className="list">
        {kunden?.map((k) => (
          <div key={k.id} className="list-item" onClick={() => navigate(`/kunden/${k.id}`)}>
            <div>
              <div className="list-title">{k.name}</div>
              <div className="list-sub">{agenturName(k.agenturId)}</div>
            </div>
            <button className="icon-btn" onClick={(e) => handleDelete(e, k.id)} aria-label="Löschen">
              ✕
            </button>
          </div>
        ))}
        {kunden?.length === 0 && <div className="empty">Noch keine Kunden angelegt.</div>}
      </div>
      <Link to="/kunden/neu" className="fab" aria-label="Kunde hinzufügen">
        +
      </Link>
    </div>
  )
}
