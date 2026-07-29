import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { kvasRepo, projekteRepo, ratecardsRepo, kundenRepo, getStammdaten } from '../../db/repo'
import type { Kva, KvaPhase, KvaZeile } from '../../db/types'
import PageHeader from '../../layout/PageHeader'
import { computeKva } from '../../utils/kva'
import { formatEuro, uid } from '../../utils/format'

type Tab = 'ratecard' | 'phasen' | 'ausgabe'

function emptyKva(projektId: number, ratecardId: number): Kva {
  return {
    projektId,
    ratecardId,
    bezeichnung: '',
    phasen: [],
    status: 'entwurf',
    erstelltAm: new Date().toISOString(),
  }
}

type LegacyKva = Omit<Kva, 'status'> & Partial<Pick<Kva, 'status'>>

function withDefaults(k: LegacyKva): Kva {
  return { status: 'entwurf', ...k }
}

export default function KvaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'neu'
  const kvaId = isNew ? undefined : Number(id)

  const existing = useSupabaseQuery(
    ['kvas'],
    () => (kvaId ? kvasRepo.get(kvaId) : Promise.resolve(undefined)),
    [kvaId],
  )
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])
  const kunden = useSupabaseQuery(['kunden'], () => kundenRepo.list(), [])
  const stammdaten = useSupabaseQuery(['stammdaten'], () => getStammdaten(), [])

  const [tab, setTab] = useState<Tab>('ratecard')
  const [form, setForm] = useState<Kva | null>(null)
  const [setupProjektId, setSetupProjektId] = useState<number | ''>('')
  const [setupRatecardId, setSetupRatecardId] = useState<number | ''>('')
  const [setupBezeichnung, setSetupBezeichnung] = useState('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // `existing` kommt aus useSupabaseQuery und wird nicht nur beim Laden neu
  // geliefert, sondern auch jedes Mal, wenn `save()` unten selbst schreibt
  // (put() ruft notify('kvas') auf, das lauscht auch diese Komponente). Ohne
  // die loadedKvaIdRef-Sperre würde also jeder eigene Speichervorgang kurz
  // danach den lokalen `form`-State mit der (evtl. noch nicht ganz aktuellen)
  // Serverantwort überschreiben — das war die Ursache dafür, dass beim
  // Tippen/Phasenwechsel Eingaben plötzlich wieder verschwanden. Deshalb wird
  // `form` nur einmal pro KVA-ID aus `existing` befüllt (initiales Laden bzw.
  // Wechsel zu einer anderen KVA), nicht bei jedem Refetch.
  const loadedKvaIdRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (existing && loadedKvaIdRef.current !== kvaId) {
      setForm(withDefaults(existing))
      loadedKvaIdRef.current = kvaId
    }
  }, [existing, kvaId])

  // Reihenfolge der Speicheraufrufe kann durcheinandergeraten (z.B. bei
  // schnellem Tippen feuert jede Änderung einen eigenen put()-Aufruf, die
  // Antworten können in anderer Reihenfolge zurückkommen). saveSeqRef sorgt
  // dafür, dass nur der zuletzt gestartete Aufruf den Anzeigestatus setzt.
  const saveSeqRef = useRef(0)

  async function save(next: Kva) {
    setForm(next)
    if (!next.id) return
    const seq = ++saveSeqRef.current
    setSaveState('saving')
    try {
      await kvasRepo.put(next as Kva & { id: number })
      if (seq === saveSeqRef.current) setSaveState('saved')
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('KVA speichern fehlgeschlagen', err)
      if (seq === saveSeqRef.current) setSaveState('error')
    }
  }

  async function handleCreate() {
    if (!setupProjektId || !setupRatecardId || !setupBezeichnung.trim()) return
    const kva = emptyKva(setupProjektId, setupRatecardId)
    kva.bezeichnung = setupBezeichnung.trim()
    const newId = await kvasRepo.add(kva)
    navigate(`/kva/${newId}`, { replace: true })
  }

  async function handleDelete() {
    if (!kvaId) return
    if (!confirm('KVA wirklich löschen?')) return
    await kvasRepo.remove(kvaId)
    navigate('/kva', { replace: true })
  }

  // Job-Pipeline: KVA annehmen → Projekt wechselt in die Ressourcenplanung,
  // wo die tatsächlich verbrauchten Stunden bestätigt werden (siehe
  // RessourcenPage.tsx). Von dort geht es automatisch weiter zur Rechnung.
  async function handleAnnehmen() {
    if (!form?.id) return
    if (!confirm('KVA als angenommen markieren? Das Projekt wechselt dann in die Ressourcenplanung.')) return
    try {
      const next: Kva & { id: number } = { ...form, id: form.id, status: 'angenommen' }
      setForm(next)
      await kvasRepo.put(next)
      await projekteRepo.update(form.projektId, { status: 'ressourcenplanung' })
      navigate('/ressourcen')
    } catch (err) {
      alert(
        'KVA annehmen fehlgeschlagen: ' +
          (err instanceof Error ? err.message : String(err)) +
          '\n\nWurden alle Datenbank-Migrationen (0011, 0012) bereits ausgeführt?',
      )
    }
  }

  if (isNew || !form) {
    return (
      <div>
        <PageHeader title="Neue KVA" />
        <div className="stack">
          <div>
            <label>Bezeichnung</label>
            <input
              className="field"
              value={setupBezeichnung}
              onChange={(e) => setSetupBezeichnung(e.target.value)}
              placeholder="z.B. KVA Kampagne Sommer 2026"
            />
          </div>
          <div>
            <label>Projekt</label>
            <select
              className="field"
              value={setupProjektId}
              onChange={(e) => setSetupProjektId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">– auswählen –</option>
              {projekte?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Ratecard</label>
            <select
              className="field"
              value={setupRatecardId}
              onChange={(e) => setSetupRatecardId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">– auswählen –</option>
              {ratecards?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.bezeichnung}
                </option>
              ))}
            </select>
            {ratecards?.length === 0 && (
              <p className="muted">Erst unter Agenturen eine Ratecard anlegen.</p>
            )}
          </div>
          <button className="btn full" onClick={handleCreate}>
            Anlegen
          </button>
        </div>
      </div>
    )
  }

  const ratecard = ratecards?.find((r) => r.id === form.ratecardId)
  const computed = computeKva(form, ratecard)
  const projekt = projekte?.find((p) => p.id === form.projektId)
  const kundeName = kunden?.find((k) => k.id === projekt?.kundeId)?.name ?? ''

  async function handleExportPdf() {
    if (!form || !stammdaten) return
    setExportingPdf(true)
    try {
      const { exportKvaPdf } = await import('../../utils/pdf/kvaPdf')
      await exportKvaPdf(form, ratecard, projekt, kundeName, stammdaten)
    } finally {
      setExportingPdf(false)
    }
  }

  async function handleExportExcel() {
    if (!form) return
    setExportingExcel(true)
    try {
      const { exportKvaExcel } = await import('../../utils/excel/kvaExcel')
      await exportKvaExcel(form, ratecard, projekt, kundeName)
    } finally {
      setExportingExcel(false)
    }
  }

  function addPhase() {
    if (!form) return
    const phase: KvaPhase = { id: uid(), bezeichnung: '', beschreibung: '', zeilen: [] }
    save({ ...form, phasen: [...form.phasen, phase] })
  }

  function updatePhase(pid: string, patch: Partial<KvaPhase>) {
    if (!form) return
    save({ ...form, phasen: form.phasen.map((p) => (p.id === pid ? { ...p, ...patch } : p)) })
  }

  function removePhase(pid: string) {
    if (!form) return
    save({ ...form, phasen: form.phasen.filter((p) => p.id !== pid) })
  }

  function addZeile(pid: string) {
    if (!form) return
    const zeile: KvaZeile = { id: uid(), rolle: ratecard?.zeilen[0]?.rolle ?? '', stunden: 0 }
    updatePhase(pid, {
      zeilen: [...(form.phasen.find((p) => p.id === pid)?.zeilen ?? []), zeile],
    })
  }

  function updateZeile(pid: string, zid: string, patch: Partial<KvaZeile>) {
    if (!form) return
    const phase = form.phasen.find((p) => p.id === pid)
    if (!phase) return
    updatePhase(pid, {
      zeilen: phase.zeilen.map((z) => (z.id === zid ? { ...z, ...patch } : z)),
    })
  }

  function removeZeile(pid: string, zid: string) {
    if (!form) return
    const phase = form.phasen.find((p) => p.id === pid)
    if (!phase) return
    updatePhase(pid, { zeilen: phase.zeilen.filter((z) => z.id !== zid) })
  }

  return (
    <div>
      <PageHeader
        title={form.bezeichnung || 'KVA'}
        action={
          <div className="row" style={{ alignItems: 'center', gap: 'var(--s2)' }}>
            {saveState === 'saving' && <span className="muted">Speichert…</span>}
            {saveState === 'saved' && <span className="muted">Gespeichert</span>}
            {saveState === 'error' && <span className="error">Fehler beim Speichern</span>}
            <button className="btn small" onClick={() => form && save(form)}>
              Speichern
            </button>
          </div>
        }
      />
      <div style={{ marginBottom: 'var(--s4)' }}>
        <span className="status-pill">{form.status === 'angenommen' ? 'Angenommen' : 'Entwurf'}</span>
      </div>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <button className={`btn small ${tab === 'ratecard' ? '' : 'ghost'}`} onClick={() => setTab('ratecard')}>
          1. Ratecard
        </button>
        <button className={`btn small ${tab === 'phasen' ? '' : 'ghost'}`} onClick={() => setTab('phasen')}>
          2. Phasen
        </button>
        <button className={`btn small ${tab === 'ausgabe' ? '' : 'ghost'}`} onClick={() => setTab('ausgabe')}>
          3. Ausgabe
        </button>
      </div>

      {tab === 'ratecard' && (
        <div className="stack">
          <div>
            <label>Bezeichnung</label>
            <input
              className="field"
              value={form.bezeichnung}
              onChange={(e) => save({ ...form, bezeichnung: e.target.value })}
            />
          </div>
          <div>
            <label>Ratecard</label>
            <select
              className="field"
              value={form.ratecardId}
              onChange={(e) => save({ ...form, ratecardId: Number(e.target.value) })}
            >
              {ratecards?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.bezeichnung}
                </option>
              ))}
            </select>
          </div>
          {ratecard && (
            <table className="calc-table">
              <thead>
                <tr>
                  <th>Rolle</th>
                  <th>Std.-Satz</th>
                  <th>Tagessatz</th>
                </tr>
              </thead>
              <tbody>
                {ratecard.zeilen.map((z) => (
                  <tr key={z.id}>
                    <td>{z.rolle}</td>
                    <td>{formatEuro(z.stundensatz)}</td>
                    <td>{formatEuro(z.tagessatz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="btn danger full" onClick={handleDelete}>
            KVA löschen
          </button>
        </div>
      )}

      {tab === 'phasen' && (
        <div className="stack">
          {form.phasen.map((phase) => (
            <div key={phase.id} className="card stack">
              <div className="row">
                <input
                  className="field"
                  placeholder="Phasenbezeichnung"
                  value={phase.bezeichnung}
                  onChange={(e) => updatePhase(phase.id, { bezeichnung: e.target.value })}
                />
                <button className="icon-btn" onClick={() => removePhase(phase.id)} aria-label="Phase löschen">
                  ✕
                </button>
              </div>
              <textarea
                className="field"
                placeholder="Leistungsbeschreibung"
                value={phase.beschreibung}
                onChange={(e) => updatePhase(phase.id, { beschreibung: e.target.value })}
              />
              {phase.zeilen.map((z) => (
                <div key={z.id} className="row" style={{ alignItems: 'flex-end' }}>
                  <div>
                    <label>Rolle</label>
                    <select
                      className="field"
                      value={z.rolle}
                      onChange={(e) => updateZeile(phase.id, z.id, { rolle: e.target.value })}
                    >
                      {ratecard?.zeilen.map((rz) => (
                        <option key={rz.id} value={rz.rolle}>
                          {rz.rolle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Stunden</label>
                    <input
                      className="field"
                      type="number"
                      value={z.stunden}
                      onChange={(e) => updateZeile(phase.id, z.id, { stunden: Number(e.target.value) })}
                    />
                  </div>
                  <button
                    className="icon-btn"
                    onClick={() => removeZeile(phase.id, z.id)}
                    aria-label="Zeile löschen"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="btn ghost small" onClick={() => addZeile(phase.id)}>
                + Rolle/Stunden
              </button>
            </div>
          ))}
          <button className="btn ghost full" onClick={addPhase}>
            + Neue Phase
          </button>
        </div>
      )}

      {tab === 'ausgabe' && (
        <div className="stack">
          <div className="section-title">Phasensummen</div>
          <table className="calc-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Summe</th>
              </tr>
            </thead>
            <tbody>
              {computed.phasenSummen.map((p) => (
                <tr key={p.phaseId}>
                  <td>{p.bezeichnung || '(ohne Titel)'}</td>
                  <td>{formatEuro(p.summe)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section-title">Aufschlüsselung nach Rolle</div>
          <table className="calc-table">
            <thead>
              <tr>
                <th>Rolle</th>
                <th>Stunden</th>
                <th>Summe</th>
              </tr>
            </thead>
            <tbody>
              {computed.rollenAufschluesselung.map((r) => (
                <tr key={r.rolle}>
                  <td>{r.rolle}</td>
                  <td>{r.stunden}</td>
                  <td>{formatEuro(r.summe)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>Kontrollsumme</strong>
            <strong>{formatEuro(computed.gesamtsumme)}</strong>
          </div>

          <button className="btn full" onClick={handleExportPdf} disabled={exportingPdf}>
            {exportingPdf ? 'PDF wird erstellt…' : 'Als PDF exportieren'}
          </button>
          <button className="btn ghost full" onClick={handleExportExcel} disabled={exportingExcel}>
            {exportingExcel ? 'Excel wird erstellt…' : 'Als Excel exportieren'}
          </button>

          {form.status !== 'angenommen' && (
            <button className="btn full" onClick={handleAnnehmen}>
              KVA annehmen → Ressourcenplanung
            </button>
          )}
          {form.status === 'angenommen' && (
            <p className="muted">
              Angenommen — Stunden werden im{' '}
              <a href="#/ressourcen" onClick={(e) => { e.preventDefault(); navigate('/ressourcen') }}>
                Ressourcentool
              </a>{' '}
              erfasst und bestätigt.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
