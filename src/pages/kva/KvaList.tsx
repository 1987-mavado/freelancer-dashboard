import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { kvasRepo, projekteRepo, ratecardsRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import PercentRing from '../../components/PercentRing'
import { computeKva } from '../../utils/kva'
import { kvaAnnehmen } from '../../utils/kvaWorkflow'
import { formatEuro } from '../../utils/format'
import type { Kva, KvaStatus } from '../../db/types'

type Filter = 'alle' | KvaStatus

const statusLabel: Record<KvaStatus, string> = {
  entwurf: 'Entwurf',
  gesendet: 'Gesendet',
  angenommen: 'Angenommen',
  abgelehnt: 'Abgelehnt',
}

const statusBadgeClass: Record<KvaStatus, string> = {
  entwurf: 'neutral',
  gesendet: 'orange',
  angenommen: 'green',
  abgelehnt: 'red',
}

const statusRing: Record<KvaStatus, { percent: number; color: string }> = {
  entwurf: { percent: 25, color: 'var(--muted)' },
  gesendet: { percent: 50, color: 'var(--orange)' },
  angenommen: { percent: 100, color: 'var(--green)' },
  abgelehnt: { percent: 0, color: 'var(--bad)' },
}

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'entwurf', label: 'Entwurf' },
  { key: 'gesendet', label: 'Gesendet' },
  { key: 'angenommen', label: 'Angenommen' },
  { key: 'abgelehnt', label: 'Abgelehnt' },
]

export default function KvaList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('alle')
  const kvas = useSupabaseQuery(['kvas'], () => kvasRepo.list(), [])
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])

  function projektName(projektId: number) {
    return projekte?.find((p) => p.id === projektId)?.name ?? '–'
  }

  async function handleAnnehmen(e: React.MouseEvent, kva: Kva) {
    e.stopPropagation()
    if (!kva.id) return
    if (!confirm('KVA als angenommen markieren? Das Projekt wird direkt abrechenbar.')) return
    await kvaAnnehmen(kva as Kva & { id: number })
  }

  async function handleDelete(e: React.MouseEvent, kva: Kva) {
    e.stopPropagation()
    if (!kva.id) return
    const frage =
      kva.status !== 'entwurf'
        ? 'Dieser KVA wurde bereits versendet — wirklich endgültig löschen?'
        : 'KVA wirklich löschen?'
    if (!confirm(frage)) return
    await kvasRepo.remove(kva.id)
  }

  const gefiltert = (kvas ?? []).filter((k) => filter === 'alle' || k.status === filter)

  return (
    <div>
      <PageHeader title="KVAs" />

      <div className="tab-bar">
        {FILTER_TABS.map((t) => (
          <button key={t.key} className={filter === t.key ? 'active' : ''} onClick={() => setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="list">
        {gefiltert.map((k) => {
          const ratecard = ratecards?.find((r) => r.id === k.ratecardId)
          const { gesamtsumme } = computeKva(k, ratecard)
          const ring = statusRing[k.status]
          return (
            <div key={k.id} className="list-item" onClick={() => navigate(`/kva/${k.id}`)}>
              <PercentRing percent={ring.percent} color={ring.color} size={44} strokeWidth={4} />
              <div style={{ flex: 1 }}>
                <div className="list-title">{k.bezeichnung}</div>
                <div className="list-sub">
                  {projektName(k.projektId)} · {formatEuro(gesamtsumme)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                <span className={`status-badge ${statusBadgeClass[k.status]}`}>{statusLabel[k.status]}</span>
                {k.status !== 'angenommen' && (
                  <button className="icon-btn" onClick={(e) => handleAnnehmen(e, k)} aria-label="Annehmen">
                    ✓
                  </button>
                )}
                <button className="icon-btn" onClick={(e) => handleDelete(e, k)} aria-label="Löschen">
                  ✕
                </button>
              </div>
            </div>
          )
        })}
        {gefiltert.length === 0 && <div className="empty">Keine KVAs in dieser Ansicht.</div>}
      </div>
      <Link to="/kva/neu" className="fab" aria-label="KVA hinzufügen">
        +
      </Link>
    </div>
  )
}
