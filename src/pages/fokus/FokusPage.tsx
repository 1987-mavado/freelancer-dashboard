import { useState } from 'react'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { todosRepo, projekteRepo, ratecardsRepo, zeiteintraegeRepo } from '../../db/repo'
import { useTimerContext } from '../../timer/TimerContext'
import { kumulierteMinutenFuerTodo, formatDauer } from '../../utils/zeiterfassung'
import { formatDate } from '../../utils/format'
import type { ToDo } from '../../db/types'
import PageHeader from '../../layout/PageHeader'
import GoogleCalendarWidget from './GoogleCalendarWidget'

interface EditForm {
  text: string
  projektId: number | ''
  rolle: string
  geschaetzteMinuten: string
  faelligkeitsdatum: string
}

function toEditForm(t: ToDo): EditForm {
  return {
    text: t.text,
    projektId: t.projektId ?? '',
    rolle: t.rolle,
    geschaetzteMinuten: t.geschaetzteMinuten ? String(t.geschaetzteMinuten) : '',
    faelligkeitsdatum: t.faelligkeitsdatum,
  }
}

function emptyEditForm(): EditForm {
  return { text: '', projektId: '', rolle: '', geschaetzteMinuten: '', faelligkeitsdatum: '' }
}

export default function FokusPage() {
  const timer = useTimerContext()
  const todos = useSupabaseQuery(
    ['todos'],
    async () => {
      const rows = await todosRepo.list()
      rows.sort((a, b) => (a.erstelltAm > b.erstelltAm ? 1 : a.erstelltAm < b.erstelltAm ? -1 : 0))
      rows.reverse()
      return rows
    },
    [],
  )
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])
  const zeiteintraege = useSupabaseQuery(['zeiteintraege'], () => zeiteintraegeRepo.list(), [])
  // Nur aktive (per KVA angenommene) Projekte sind als abrechenbarer Job
  // auswählbar.
  const aktiveProjekte = (projekte ?? []).filter((p) => p.status === 'aktiv')

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<EditForm>(emptyEditForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm())

  function projektName(id?: number | null) {
    return projekte?.find((p) => p.id === id)?.name ?? '–'
  }

  function jobLabel(id: number) {
    const p = projekte?.find((x) => x.id === id)
    if (!p) return '–'
    return p.nummer ? `${p.nummer} – ${p.name}` : p.name
  }

  function rollenOptionen(projektId: number | '') {
    const projekt = projekte?.find((p) => p.id === projektId)
    if (!projekt?.agenturId) return []
    const zeilen = (ratecards ?? []).filter((r) => r.agenturId === projekt.agenturId).flatMap((r) => r.zeilen)
    return Array.from(new Set(zeilen.map((z) => z.rolle))).filter(Boolean)
  }

  async function addTodo() {
    if (!addForm.text.trim()) return
    await todosRepo.add({
      text: addForm.text.trim(),
      erledigt: false,
      projektId: addForm.projektId || null,
      rolle: addForm.rolle.trim(),
      geschaetzteMinuten: addForm.geschaetzteMinuten ? Math.round(Number(addForm.geschaetzteMinuten)) : 0,
      faelligkeitsdatum: addForm.faelligkeitsdatum,
      erstelltAm: new Date().toISOString(),
    })
    setAddForm(emptyEditForm())
    setAddOpen(false)
  }

  function startEdit(t: ToDo) {
    setEditingId(t.id ?? null)
    setEditForm(toEditForm(t))
  }

  async function saveEdit(id: number) {
    await todosRepo.update(id, {
      text: editForm.text.trim(),
      projektId: editForm.projektId || null,
      rolle: editForm.rolle.trim(),
      geschaetzteMinuten: editForm.geschaetzteMinuten ? Math.round(Number(editForm.geschaetzteMinuten)) : 0,
      faelligkeitsdatum: editForm.faelligkeitsdatum,
    })
    setEditingId(null)
  }

  async function toggleTodo(id?: number, erledigt?: boolean) {
    if (!id) return
    await todosRepo.update(id, { erledigt: !erledigt })
  }

  async function deleteTodo(id?: number) {
    if (!id) return
    await todosRepo.remove(id)
  }

  return (
    <div>
      <PageHeader title="Fokus &amp; To-Do" back={false} />

      <GoogleCalendarWidget />

      <div className="section-title">Aufgaben</div>
      <p className="muted">
        Aufgabe mit Projekt, Rolle und geschätzter Zeit anlegen, dann per ▶ direkt den Timer starten — die
        erfasste Zeit fließt automatisch in die Stundenzahl der Aufgabe und kann später in eine Rechnung
        übernommen werden.
      </p>

      <div className="list">
        {todos?.map((t) => {
          const istAktiv = timer.laufendesTodo?.id === t.id && timer.phase !== 'idle'
          const kannStarten =
            !t.erledigt && !!t.projektId && t.geschaetzteMinuten > 0 && timer.phase === 'idle' && !istAktiv
          const kumuliert = t.id ? kumulierteMinutenFuerTodo(zeiteintraege ?? [], t.id) : 0
          const wirdBearbeitet = editingId === t.id

          if (wirdBearbeitet) {
            return (
              <div key={t.id} className="card stack">
                <input
                  className="field"
                  value={editForm.text}
                  onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
                />
                <div className="row">
                  <div>
                    <label>Projekt (optional, für Abrechnung)</label>
                    <select
                      className="field"
                      value={editForm.projektId}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, projektId: e.target.value ? Number(e.target.value) : '' }))
                      }
                    >
                      <option value="">– kein Projekt –</option>
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
                      list="fokus-rollen"
                      value={editForm.rolle}
                      onChange={(e) => setEditForm((f) => ({ ...f, rolle: e.target.value }))}
                    />
                    <datalist id="fokus-rollen">
                      {rollenOptionen(editForm.projektId).map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div className="row">
                  <div>
                    <label>Geschätzte Zeit (Minuten)</label>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      step="5"
                      value={editForm.geschaetzteMinuten}
                      onChange={(e) => setEditForm((f) => ({ ...f, geschaetzteMinuten: e.target.value }))}
                      placeholder="z.B. 25"
                    />
                  </div>
                  <div>
                    <label>Fällig am (optional, für Kalender)</label>
                    <input
                      className="field"
                      type="date"
                      value={editForm.faelligkeitsdatum}
                      onChange={(e) => setEditForm((f) => ({ ...f, faelligkeitsdatum: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="row">
                  <button className="btn ghost" onClick={() => setEditingId(null)}>
                    Abbrechen
                  </button>
                  <button className="btn" onClick={() => t.id && saveEdit(t.id)}>
                    Speichern
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div
              key={t.id}
              className={`list-item${istAktiv && timer.phase !== 'arbeit' ? ' rot' : ''}`}
              style={{ cursor: 'default', alignItems: 'flex-start' }}
            >
              <div className="checkbox-row" style={{ alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={t.erledigt}
                  disabled={istAktiv}
                  onChange={() => toggleTodo(t.id, t.erledigt)}
                />
                <div>
                  <div className={t.erledigt ? 'strikethrough' : ''}>{t.text}</div>
                  <div className="list-sub">
                    {t.projektId
                      ? `${projektName(t.projektId)} · ${t.rolle || 'ohne Rolle'} · ${t.geschaetzteMinuten} Min. geschätzt`
                      : 'Keine Abrechnung hinterlegt'}
                    {kumuliert > 0 && ` · ${formatDauer(kumuliert)} erfasst`}
                    {t.faelligkeitsdatum && ` · fällig ${formatDate(t.faelligkeitsdatum)}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)' }}>
                {istAktiv ? (
                  <span className="status-pill">
                    {timer.phase === 'arbeit' ? 'Läuft…' : timer.phase === 'pause-bereit' ? 'Beendet' : 'Pause'}
                  </span>
                ) : (
                  <>
                    {kannStarten && (
                      <button
                        className="icon-btn"
                        onClick={() => timer.start(t)}
                        aria-label="Timer starten"
                        title="Timer starten"
                      >
                        ▶
                      </button>
                    )}
                    <button className="icon-btn" onClick={() => startEdit(t)} aria-label="Bearbeiten">
                      ✎
                    </button>
                    <button className="icon-btn" onClick={() => deleteTodo(t.id)} aria-label="Löschen">
                      ✕
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
        {todos?.length === 0 && <div className="empty">Keine offenen Aufgaben.</div>}
      </div>

      {addOpen && (
        <div className="card stack">
          <input
            className="field"
            placeholder="Neue Aufgabe…"
            value={addForm.text}
            onChange={(e) => setAddForm((f) => ({ ...f, text: e.target.value }))}
          />
          <div className="row">
            <div>
              <label>Projekt (optional, für Abrechnung)</label>
              <select
                className="field"
                value={addForm.projektId}
                onChange={(e) => setAddForm((f) => ({ ...f, projektId: e.target.value ? Number(e.target.value) : '' }))}
              >
                <option value="">– kein Projekt –</option>
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
                list="fokus-rollen-add"
                value={addForm.rolle}
                onChange={(e) => setAddForm((f) => ({ ...f, rolle: e.target.value }))}
              />
              <datalist id="fokus-rollen-add">
                {rollenOptionen(addForm.projektId).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="row">
            <div>
              <label>Geschätzte Zeit (Minuten, für Play-Timer nötig)</label>
              <input
                className="field"
                type="number"
                min="0"
                step="5"
                value={addForm.geschaetzteMinuten}
                onChange={(e) => setAddForm((f) => ({ ...f, geschaetzteMinuten: e.target.value }))}
                placeholder="z.B. 25"
              />
            </div>
            <div>
              <label>Fällig am (optional, für Kalender)</label>
              <input
                className="field"
                type="date"
                value={addForm.faelligkeitsdatum}
                onChange={(e) => setAddForm((f) => ({ ...f, faelligkeitsdatum: e.target.value }))}
              />
            </div>
          </div>
          <div className="row">
            <button
              className="btn ghost"
              onClick={() => {
                setAddOpen(false)
                setAddForm(emptyEditForm())
              }}
            >
              Abbrechen
            </button>
            <button className="btn" onClick={addTodo}>
              Anlegen
            </button>
          </div>
        </div>
      )}

      {!addOpen && (
        <button className="fab" onClick={() => setAddOpen(true)} aria-label="Aufgabe hinzufügen">
          +
        </button>
      )}
    </div>
  )
}
