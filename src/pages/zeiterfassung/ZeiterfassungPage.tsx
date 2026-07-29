import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { zeiteintraegeRepo, projekteRepo, ratecardsRepo, todosRepo } from '../../db/repo'
import { useTimerContext } from '../../timer/TimerContext'
import { ensureOffeneRechnungFuerProjekt } from '../../utils/rechnung'
import PageHeader from '../../layout/PageHeader'
import { formatDate, todayISO } from '../../utils/format'
import { formatDauer, formatVerstrichen } from '../../utils/zeiterfassung'
import type { Zeiteintrag, ToDo } from '../../db/types'

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

// Ein "Job" im Sinne dieser Seite ist eine über eine Aufgabe (ToDo) gestartete
// Zeitreihe: mehrere Start/Stopp-Segmente (todoId identisch) werden zu einer
// Zeile mit Gesamtzeit zusammengefasst, mit Möglichkeit, nach einer Pause
// einen weiteren Block zu starten ("Fortsetzen" — nutzt denselben
// TimerContext.start() wie die Fokus-Seite). Einträge ohne Aufgabenbezug
// (manuell erfasst) bleiben einzeln, unveränderte Darstellung wie bisher.
interface JobGruppe {
  todoId: number
  todo: ToDo | undefined
  eintraege: Zeiteintrag[]
  gesamtMinuten: number
  alleAbgerechnet: boolean
}

export default function ZeiterfassungPage() {
  const navigate = useNavigate()
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
  const todos = useSupabaseQuery(['todos'], () => todosRepo.list(), [])
  // Nur aktive (per KVA angenommene) Projekte sind als Job auswählbar —
  // abgeschlossene/pausierte/akquise-Projekte tauchen hier nicht mehr auf.
  const aktiveProjekte = (projekte ?? []).filter((p) => p.status === 'aktiv')

  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState<ManualForm>(emptyManual())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ManualForm>(emptyManual())
  const [expandedTodoId, setExpandedTodoId] = useState<number | null>(null)

  function projektName(id?: number) {
    return projekte?.find((p) => p.id === id)?.name ?? '–'
  }

  function jobLabel(id: number) {
    const p = projekte?.find((x) => x.id === id)
    if (!p) return '–'
    return p.nummer ? `${p.nummer} – ${p.name}` : p.name
  }

  async function handleUebernehmen(z: Zeiteintrag) {
    if (z.abgerechnet) return
    const rechnungId = await ensureOffeneRechnungFuerProjekt(z.projektId)
    navigate(`/rechnungen/${rechnungId}`)
  }

  async function handleFortsetzen(todo: ToDo) {
    if (timer.phase !== 'idle') return
    await timer.start(todo)
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

  // Nach Job (todoId) gruppieren, Reihenfolge bleibt (bereits nach Datum/
  // Erstellzeit absteigend sortiert) — der jeweils erste Treffer einer
  // todoId bestimmt die Position der zusammengefassten Zeile.
  const gesehen = new Set<number>()
  type Zeile = { key: string; gruppe?: JobGruppe; einzel?: Zeiteintrag }
  const zeilen: Zeile[] = []
  for (const z of abgeschlosseneEintraege) {
    if (z.todoId) {
      if (gesehen.has(z.todoId)) continue
      gesehen.add(z.todoId)
      const eintraege = abgeschlosseneEintraege.filter((x) => x.todoId === z.todoId)
      zeilen.push({
        key: `job-${z.todoId}`,
        gruppe: {
          todoId: z.todoId,
          todo: todos?.find((t) => t.id === z.todoId),
          eintraege,
          gesamtMinuten: eintraege.reduce((sum, e) => sum + e.dauerMinuten, 0),
          alleAbgerechnet: eintraege.every((e) => e.abgerechnet),
        },
      })
    } else {
      zeilen.push({ key: `einzel-${z.id}`, einzel: z })
    }
  }

  function renderEditForm(z: Zeiteintrag) {
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
              {aktiveProjekte.map((p) => (
                <option key={p.id} value={p.id}>
                  {jobLabel(p.id!)}
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

  function renderEintragZeile(z: Zeiteintrag) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
          <span className={`status-badge ${z.abgerechnet ? 'green' : 'neutral'}`}>
            {z.abgerechnet ? 'Abgerechnet' : 'Offen'}
          </span>
          {!z.abgerechnet && (
            <button className="icon-btn" onClick={() => handleUebernehmen(z)} aria-label="In Rechnung übernehmen">
              ✓
            </button>
          )}
          <button className="icon-btn" onClick={() => startEdit(z)} aria-label="Bearbeiten">
            ✎
          </button>
          <button className="icon-btn" onClick={() => handleDelete(z.id)} aria-label="Löschen">
            ✕
          </button>
        </div>
      </div>
    )
  }

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
        {zeilen.map((zeile) => {
          if (zeile.einzel) {
            const z = zeile.einzel
            return editingId === z.id ? renderEditForm(z) : renderEintragZeile(z)
          }

          const g = zeile.gruppe!
          const expanded = expandedTodoId === g.todoId
          const kannFortsetzen = g.todo && !g.todo.erledigt && g.todo.geschaetzteMinuten > 0 && timer.phase === 'idle'
          const ersterEintrag = g.eintraege[0]

          return (
            <div key={zeile.key} className="stack" style={{ gap: 'var(--s2)' }}>
              <div
                className="list-item"
                onClick={() => setExpandedTodoId(expanded ? null : g.todoId)}
              >
                <div>
                  <div className="list-title">{g.todo?.text ?? `${projektName(ersterEintrag.projektId)} · ${ersterEintrag.rolle}`}</div>
                  <div className="list-sub">
                    {projektName(ersterEintrag.projektId)} · {ersterEintrag.rolle} · {formatDauer(g.gesamtMinuten)} gesamt
                    {g.eintraege.length > 1 ? ` (${g.eintraege.length} Abschnitte)` : ''}
                    {g.todo?.geschaetzteMinuten ? ` · ${g.todo.geschaetzteMinuten} Min. geschätzt` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                  <span className={`status-badge ${g.alleAbgerechnet ? 'green' : 'neutral'}`}>
                    {g.alleAbgerechnet ? 'Abgerechnet' : 'Offen'}
                  </span>
                  {kannFortsetzen && (
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFortsetzen(g.todo!)
                      }}
                      aria-label="Fortsetzen"
                      title="Fortsetzen"
                    >
                      ▶
                    </button>
                  )}
                  <span className="muted">{expanded ? '▾' : '▸'}</span>
                </div>
              </div>
              {expanded && (
                <div className="stack" style={{ paddingLeft: 'var(--s4)', gap: 'var(--s2)' }}>
                  {g.eintraege.map((z) => (editingId === z.id ? renderEditForm(z) : renderEintragZeile(z)))}
                </div>
              )}
            </div>
          )
        })}
        {zeilen.length === 0 && <div className="empty">Noch keine Zeiteinträge erfasst.</div>}
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
              {aktiveProjekte.map((p) => (
                <option key={p.id} value={p.id}>
                  {jobLabel(p.id!)}
                </option>
              ))}
            </select>
            {aktiveProjekte.length === 0 && (
              <p className="muted">Kein aktiver Job — erst eine KVA annehmen oder ein Projekt aktivieren.</p>
            )}
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
