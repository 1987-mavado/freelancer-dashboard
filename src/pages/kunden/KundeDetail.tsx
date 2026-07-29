import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { kundenRepo, agenturenRepo, projekteRepo, rechnungenRepo, kvasRepo, ratecardsRepo } from '../../db/repo'
import type { Kunde, ProjektStatus, Zahlungsstatus } from '../../db/types'
import PageHeader from '../../layout/PageHeader'
import { computeKva } from '../../utils/kva'
import { rechnungTotals } from '../../utils/rechnung'
import { formatEuro, formatDate } from '../../utils/format'

const projektStatusLabel: Record<ProjektStatus, string> = {
  akquise: 'Akquise',
  aktiv: 'Aktiv',
  ressourcenplanung: 'Ressourcenplanung',
  pausiert: 'Pausiert',
  abgeschlossen: 'Abgeschlossen',
}

const rechnungStatusColor: Record<Zahlungsstatus, string> = {
  offen: 'yellow',
  bezahlt: 'green',
  ueberfaellig: 'orange',
}

const rechnungStatusLabel: Record<Zahlungsstatus, string> = {
  offen: 'Offen',
  bezahlt: 'Bezahlt',
  ueberfaellig: 'Überfällig',
}

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

  // Historie: alle Projekte dieses Kunden sowie die daran hängenden KVAs und
  // Rechnungen (beide referenzieren nur projektId, nicht direkt kundeId).
  // Jede Query ermittelt die zugehörigen Projekt-IDs unabhängig selbst
  // (statt sich auf das Ergebnis der anderen Query zu verlassen), damit
  // useSupabaseQuery nicht mit einem sich bei jedem Render ändernden
  // Array als Dependency neu lädt.
  const projekte = useSupabaseQuery(
    ['projekte'],
    async () => (await projekteRepo.list()).filter((p) => p.kundeId === kundeId),
    [kundeId],
  )
  const kvas = useSupabaseQuery(
    ['kvas', 'projekte'],
    async () => {
      const projektIds = new Set(
        (await projekteRepo.list()).filter((p) => p.kundeId === kundeId).map((p) => p.id),
      )
      return (await kvasRepo.list()).filter((k) => projektIds.has(k.projektId))
    },
    [kundeId],
  )
  const rechnungen = useSupabaseQuery(
    ['rechnungen', 'projekte'],
    async () => {
      const projektIds = new Set(
        (await projekteRepo.list()).filter((p) => p.kundeId === kundeId).map((p) => p.id),
      )
      return (await rechnungenRepo.list()).filter((r) => projektIds.has(r.projektId))
    },
    [kundeId],
  )
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])

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

      {!isNew && (
        <>
          <div className="section-title">Projekte</div>
          <div className="list">
            {projekte?.map((p) => (
              <Link key={p.id} to={`/projekte/${p.id}`} className="list-item">
                <div>
                  <div className="list-title">{p.name}</div>
                  <div className="list-sub">{p.nummer}</div>
                </div>
                <span className="status-pill">{projektStatusLabel[p.status]}</span>
              </Link>
            ))}
            {projekte?.length === 0 && <div className="empty">Noch keine Projekte mit diesem Kunden.</div>}
          </div>

          <div className="section-title">KVAs</div>
          <div className="list">
            {kvas?.map((k) => {
              const ratecard = ratecards?.find((r) => r.id === k.ratecardId)
              const { gesamtsumme } = computeKva(k, ratecard)
              return (
                <Link key={k.id} to={`/kva/${k.id}`} className="list-item">
                  <div className="list-title">{k.bezeichnung}</div>
                  <span className="status-pill">{formatEuro(gesamtsumme)}</span>
                </Link>
              )
            })}
            {kvas?.length === 0 && <div className="empty">Noch keine KVAs mit diesem Kunden.</div>}
          </div>

          <div className="section-title">Rechnungen</div>
          <div className="list">
            {rechnungen?.map((r) => {
              const { brutto } = rechnungTotals(r.positionen, r.ustSatz)
              return (
                <Link key={r.id} to={`/rechnungen/${r.id}`} className="list-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                    <span className={`badge ${rechnungStatusColor[r.zahlungsstatus]}`} />
                    <div>
                      <div className="list-title">{r.rechnungsnummer}</div>
                      <div className="list-sub">
                        {formatEuro(brutto)} · fällig {formatDate(r.faelligkeitsdatum)}
                      </div>
                    </div>
                  </div>
                  <span className="status-pill">{rechnungStatusLabel[r.zahlungsstatus]}</span>
                </Link>
              )
            })}
            {rechnungen?.length === 0 && <div className="empty">Noch keine Rechnungen mit diesem Kunden.</div>}
          </div>
        </>
      )}
    </div>
  )
}
