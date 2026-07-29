import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { rechnungenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import PercentRing from '../../components/PercentRing'
import { rechnungTotals } from '../../utils/rechnung'
import { formatEuro, formatDate } from '../../utils/format'
import type { Zahlungsstatus } from '../../db/types'

type Filter = 'alle' | Zahlungsstatus

const statusBadgeClass: Record<Zahlungsstatus, string> = {
  offen: 'orange',
  bezahlt: 'green',
  ueberfaellig: 'red',
}

const statusLabel: Record<Zahlungsstatus, string> = {
  offen: 'Offen',
  bezahlt: 'Bezahlt',
  ueberfaellig: 'Überfällig',
}

const statusRing: Record<Zahlungsstatus, { percent: number; color: string }> = {
  offen: { percent: 33, color: 'var(--yellow)' },
  ueberfaellig: { percent: 66, color: 'var(--bad)' },
  bezahlt: { percent: 100, color: 'var(--green)' },
}

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: 'alle', label: 'Alle' },
  { key: 'offen', label: 'Offen' },
  { key: 'ueberfaellig', label: 'Überfällig' },
  { key: 'bezahlt', label: 'Bezahlt' },
]

export default function RechnungenList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('alle')
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])

  async function handleDelete(e: React.MouseEvent, id?: number) {
    e.stopPropagation()
    if (!id) return
    if (!confirm('Rechnung wirklich löschen?')) return
    await rechnungenRepo.remove(id)
  }

  const gefiltert = (rechnungen ?? []).filter((r) => filter === 'alle' || r.zahlungsstatus === filter)

  return (
    <div>
      <PageHeader title="Rechnungen" />

      <div className="tab-bar">
        {FILTER_TABS.map((t) => (
          <button key={t.key} className={filter === t.key ? 'active' : ''} onClick={() => setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="list">
        {gefiltert.map((r) => {
          const { brutto } = rechnungTotals(r.positionen, r.ustSatz)
          const ring = statusRing[r.zahlungsstatus]
          return (
            <div key={r.id} className="list-item" onClick={() => navigate(`/rechnungen/${r.id}`)}>
              <PercentRing percent={ring.percent} color={ring.color} size={44} strokeWidth={4} />
              <div style={{ flex: 1 }}>
                <div className="list-title">{r.rechnungsnummer}</div>
                <div className="list-sub">
                  {formatEuro(brutto)} · fällig {formatDate(r.faelligkeitsdatum)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                <span className={`status-badge ${statusBadgeClass[r.zahlungsstatus]}`}>
                  {statusLabel[r.zahlungsstatus]}
                </span>
                <button className="icon-btn" onClick={(e) => handleDelete(e, r.id)} aria-label="Löschen">
                  ✕
                </button>
              </div>
            </div>
          )
        })}
        {gefiltert.length === 0 && <div className="empty">Keine Rechnungen in dieser Ansicht.</div>}
      </div>
      <Link to="/rechnungen/neu" className="fab" aria-label="Rechnung hinzufügen">
        +
      </Link>
    </div>
  )
}
