import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { zeiteintraegeRepo, projekteRepo, ratecardsRepo } from '../../db/repo'
import { useTimerContext } from '../../timer/TimerContext'
import PageHeader from '../../layout/PageHeader'
import { formatDate, todayISO } from '../../utils/format'
import { formatDauer, formatVerstrichen } from '../../utils/zeiterfassung'
import type { Zeiteintrag } from '../../db/types'

interface ManualForm {
  projektId: number | ''
  rolle: string
  datum: string
  stunden: string
  beschreibung: string
}

function emptyManual(): ManualForm {
  return { projektId: '', rolle: '', datum: todayISO(), stunden: '', beschreibung: '' }
}

function toEditForm(z: Zeiteintrag): ManualForm {
  return {
    projektId: z.projektId,
    rolle: z.rolle,
    datum: z.datum,
    stunden: String(Math.round((z.dauerMinuten / 60) * 100) / 100),
    beschreibung: z.beschreibung,
  }
}

export default function ZeiterfassungPage() {
  const timer = useTimerContext()
  const zeiteintraege = useSupabaseQuery(
    ['zeiteintraege'],
    async () => {
      const rows = await zeiteintraegeRepo.list()
      rows.sort((a, b) =>
        a.datum === b.datum ? (a.erstelltAm < b.erstelltAm ? 1 : -1) : a.datum < b.datum ? 1 : -1,
      )
      return rows
    },
    [],
  )
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])

  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState<ManualForm>(emptyManual())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ManualForm>(emptyManual())

  function projektName(id?: number) {
    return projekte?.find((p) => p.id === id)?.name ?? '–'
  }

  function rollenOptionen(projektId: number | '') {
    const projekt = projekte?.find((p) => p.id === projektId)
    if (!projekt?.agenturId) return []
    const zeilen = (ratecards ?? []).filter((r) => r.agenturId === projekt.agenturId).flatMap((r) => r.zeilen)
    return Array.from(new Set(zeilen.map((z) => z.rolle))).filter(Boolean)
  }

  async function handleManualAdd() {
    const stunden = parseFloat(manual.stunden.replace(',', '.'))
    if (!manual.projektId || !manual.rolle.trim() || !stunden || stunden <= 0) return
    await zeiteintraegeRepo.add({
      projektId: manual.projektId,
      rolle: manual.rolle.trim(),
      datum: manual.datum,
      startZeit: null,
      dauerMinuten: Math.round(stunden * 60),
      laeuft: false,
      beschreibung: manual.beschreibung.trim(),
      abgerechnet: false,
      todoId: null,
      erstelltAm: new Date().toISOString(),
    })
    setManual(emptyManual())
    setManualOpen(false)
  }

  function startEdit(z: Zeiteintrag) {
    setEditingId(z.id ?? null)
    setEditForm(toEditForm(z))
  }

  async function saveEdit(id: number) {
    const stunden = parseFloat(editForm.stunden.replace(',', '.'))
    if (!editForm.projektId || !editForm.rolle.trim() || !stunden || stunden <= 0) return
    await zeiteintraegeRepo.update(id, {
      projektId: editForm.projektId,
      rolle: editForm.rolle.trim(),
      datum: editForm.datum,
      dauerMinuten: Math.round(stunden * 60),
      beschreibung: editForm.beschreibung.trim(),
    })
    setEditingId(null)
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm('Zeiteintrag wirklich löschen?')) return
    await zeiteintraegeRepo.remove(id)
  }

  const abgeschlosseneEintraege = zeiteintraege?.filter((z) => !z.laeuft) ?? []

  return (
    <div>
      <PageHeader title="Zeiterfassung" back={false} />

      <div className="card">
        {timer.phase !== 'idle' ? (
          <>
            <div className="timer-mode">
              {timer.phase === 'arbeit' && `Läuft · ${timer.laufendesTodo?.text ?? ''}`}
              {timer.phase === 'pause-bereit' && 'Aufgabe beendet · Pause bereit'}
              {timer.phase === 'pause-laeuft' && 'Pause läuft'}
            </div>
            {timer.phase === 'arbeit' && (
              <div className="timer-display">{formatVerstrichen(Math.max(0, timer.restSekundenArbeit))}</div>
            )}
            {timer.phase === 'pause-laeuft' && (
              <div className="timer-display">{formatVerstrichen(Math.max(0, timer.restSekundenPause))}</div>
            )}
            <div className="row">
              {timer.phase === 'arbeit' && (
                <button className="btn" onClick={timer.stopManuell}>
                  Stoppen
                </button>
              )}
              {timer.phase === 'pause-bereit' && (
                <button className="btn" onClick={timer.startPause}>
                  5-Min-Pause starten
                </button>
              )}
              {timer.phase === 'pause-laeuft' && (
                <button className="btn ghost" onClick={timer.pauseUeberspringen}>
                  Pause beenden
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Timer werden über eine Aufgabe mit Projekt, Rolle und geschätzter Zeit gestartet.
            </p>
            <Link to="/fokus" className="btn ghost full" style={{ textAlign: 'center' }}>
              Zu Fokus &amp; To-Do
            </Link>
          </div>
        )}
      </div>

      <div className="section-title">Einträge</div>
      <div className="list">
        {abgeschlosseneEintraege.map((z) => {
          if (editingId === z.id) {
            return (
              <div key={z.id} className="card stack">
                <div className="row">
                  <div>
                    <label>Projekt</label>
                    <select
                      className="field"
                      value={editForm.projektId}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, projektId: e.target.value ? Number(e.target.value) : '' }))
                      }
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
                    <label>Rolle</label>
                    <input
                      className="field"
                      list="zeit-edit-rollen"
                      value={editForm.rolle}
                      onChange={(e) => setEditForm((f) => ({ ...f, rolle: e.target.value }))}
                    />
                    <datalist id="zeit-edit-rollen">
                      {rollenOptionen(editForm.projektId).map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="row">
                  <div>
                    <label>Datum</label>
                    <input
                      className="field"
                      type="date"
                      value={editForm.datum}
                      onChange={(e) => setEditForm((f) => ({ ...f, datum: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label>Dauer (Stunden)</label>
                    <input
                      className="field"
                      type="number"
                      step="0.25"
                      min="0"
                      value={editForm.stunden}
                      onChange={(e) => setEditForm((f) => ({ ...f, stunden: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label>Beschreibung (optional)</label>
                  <input
                    className="field"
                    value={editForm.beschreibung}
                    onChange={(e) => setEditForm((f) => ({ ...f, beschreibung: e.target.value }))}
                  />
                </div>
                <div className="row">
                  <button className="btn ghost" onClick={() => setEditingId(null)}>
                    Abbrechen
                  </button>
                  <button className="btn" onClick={() => z.id && saveEdit(z.id)}>
                    Speichern
                  </button>
                </div>
              </div>
            )
          }
          return (
            <div key={z.id} className="list-item" style={{ cursor: 'default' }}>
              <div>
                <div className="list-title">
                  {projektName(z.projektId)} · {z.rolle}
                </div>
                <div className="list-sub">
                  {formatDate(z.datum)} · {formatDauer(z.dauerMinuten)}
                  {z.beschreibung ? ` · ${z.beschreibung}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
                <span className="status-pill">{z.abgerechnet ? 'Abgerechnet' : 'Offen'}</span>
                <button className="icon-btn" onClick={() => startEdit(z)} aria-label="Bearbeiten">
                  ✎
                </button>
                <button className="icon-btn" onClick={() => handleDelete(z.id)} aria-label="Löschen">
                  ✕
                </button>
              </div>
            </div>
          )
        })}
        {abgeschlosseneEintraege.length === 0 && <div className="empty">Noch keine Zeiteinträge erfasst.</div>}
      </div>

      {manualOpen && (
        <div className="card stack">
          <div>
            <label>Projekt</label>
            <select
              className="field"
              value={manual.projektId}
              onChange={(e) => setManual((m) => ({ ...m, projektId: e.target.value ? Number(e.target.value) : '' }))}
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
            <label>Rolle</label>
            <input
              className="field"
              list="manual-rollen"
              value={manual.rolle}
              onChange={(e) => setManual((m) => ({ ...m, rolle: e.target.value }))}
            />
            <datalist id="manual-rollen">
              {rollenOptionen(manual.projektId).map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
          <div className="row">
            <div>
              <label>Datum</label>
              <input
                className="field"
                type="date"
                value={manual.datum}
                onChange={(e) => setManual((m) => ({ ...m, datum: e.target.value }))}
              />
            </div>
            <div>
              <label>Dauer (Stunden)</label>
              <input
                className="field"
                type="number"
                step="0.25"
                min="0"
                value={manual.stunden}
                onChange={(e) => setManual((m) => ({ ...m, stunden: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label>Beschreibung (optional)</label>
            <input
              className="field"
              value={manual.beschreibung}
              onChange={(e) => setManual((m) => ({ ...m, beschreibung: e.target.value }))}
            />
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => setManualOpen(false)}>
              Abbrechen
            </button>
            <button className="btn" onClick={handleManualAdd}>
              Speichern
            </button>
          </div>
        </div>
      )}

      {!manualOpen && (
        <button className="fab" onClick={() => setManualOpen(true)} aria-label="Zeit manuell erfassen">
          +
        </button>
      )}
    </div>
  )
}
