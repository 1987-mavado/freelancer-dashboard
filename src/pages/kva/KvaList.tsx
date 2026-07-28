import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { kvasRepo, projekteRepo, ratecardsRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import { computeKva } from '../../utils/kva'
import { formatEuro } from '../../utils/format'

export default function KvaList() {
  const kvas = useSupabaseQuery(['kvas'], () => kvasRepo.list(), [])
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])

  function projektName(projektId: number) {
    return projekte?.find((p) => p.id === projektId)?.name ?? '–'
  }

  return (
    <div>
      <PageHeader title="KVAs" />
      <div className="list">
        {kvas?.map((k) => {
          const ratecard = ratecards?.find((r) => r.id === k.ratecardId)
          const { gesamtsumme } = computeKva(k, ratecard)
          return (
            <Link key={k.id} to={`/kva/${k.id}`} className="list-item">
              <div>
                <div className="list-title">{k.bezeichnung}</div>
                <div className="list-sub">{projektName(k.projektId)}</div>
              </div>
              <span className="status-pill">{formatEuro(gesamtsumme)}</span>
            </Link>
          )
        })}
        {kvas?.length === 0 && <div className="empty">Noch keine KVAs angelegt.</div>}
      </div>
      <Link to="/kva/neu" className="fab" aria-label="KVA hinzufügen">
        +
      </Link>
    </div>
  )
}
