import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { kvasRepo, projekteRepo, ratecardsRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import { computeKva } from '../../utils/kva'
import { formatEuro } from '../../utils/format'

export default function KvaList() {
  const navigate = useNavigate()
  const kvas = useSupabaseQuery(['kvas'], () => kvasRepo.list(), [])
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])

  function projektName(projektId: number) {
    return projekte?.find((p) => p.id === projektId)?.name ?? '–'
  }

  async function handleDelete(e: React.MouseEvent, id?: number) {
    e.stopPropagation()
    if (!id) return
    if (!confirm('KVA wirklich löschen?')) return
    await kvasRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="KVAs" />
      <div className="list">
        {kvas?.map((k) => {
          const ratecard = ratecards?.find((r) => r.id === k.ratecardId)
          const { gesamtsumme } = computeKva(k, ratecard)
          return (
            <div key={k.id} className="list-item" onClick={() => navigate(`/kva/${k.id}`)}>
              <div>
                <div className="list-title">{k.bezeichnung}</div>
                <div className="list-sub">{projektName(k.projektId)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                <span className="status-pill">{formatEuro(gesamtsumme)}</span>
                <button className="icon-btn" onClick={(e) => handleDelete(e, k.id)} aria-label="Löschen">
                  ✕
                </button>
              </div>
            </div>
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
