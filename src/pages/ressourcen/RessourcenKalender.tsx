import { useState } from 'react'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { ressourcenplanRepo, ratecardsRepo } from '../../db/repo'
import { formatDate } from '../../utils/format'
import { auslastungsStufe } from '../../utils/zeiterfassung'
import type { Projekt } from '../../db/types'

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

interface MonatState {
  jahr: number
  monat: number
}

function buildMonthGrid(jahr: number, monat: number): string[] {
  const erster = new Date(jahr, monat, 1)
  const ersterWochentag = (erster.getDay() + 6) % 7 // 0 = Montag
  const start = new Date(jahr, monat, 1 - ersterWochentag)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function shiftMonth(m: MonatState, delta: number): MonatState {
  const d = new Date(m.jahr, m.monat + delta, 1)
  return { jahr: d.getFullYear(), monat: d.getMonth() }
}

interface EintragForm {
  projektId: number | ''
  rolle: string
  stunden: string
}

function emptyForm(): EintragForm {
  return { projektId: '', rolle: '', stunden: '' }
}

// Gemeinsamer Planungskalender über alle Projekte in der Ressourcenplanung:
// pro Tag lassen sich Personentage/-stunden je Projekt und Rolle eintragen,
// unabhängig von der tatsächlichen Zeiterfassung (die zeigt nur die Vergangenheit).
export default function RessourcenKalender({ projekte }: { projekte: Projekt[] }) {
  const [monat, setMonat] = useState<MonatState>(() => {
    const heute = new Date()
    return { jahr: heute.getFullYear(), monat: heute.getMonth() }
  })
  const [ausgewaehlterTag, setAusgewaehlterTag] = useState<string | null>(null)
  const [form, setForm] = useState<EintragForm>(emptyForm())

  const plan = useSupabaseQuery(['ressourcenplan'], () => ressourcenplanRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])

  const projektIds = new Set(projekte.map((p) => p.id))
  const planGefiltert = (plan ?? []).filter((e) => projektIds.has(e.projektId))
  const tage = buildMonthGrid(monat.jahr, monat.monat)

  function stundenAmTag(datum: string): number {
    return planGefiltert.filter((e) => e.datum === datum).reduce((sum, e) => sum + e.geplanteStunden, 0)
  }

  function projektName(id: number): string {
    return projekte.find((p) => p.id === id)?.name ?? '–'
  }

  function rollenOptionen(projektId: number | ''): string[] {
    const projekt = projekte.find((p) => p.id === projektId)
    if (!projekt?.agenturId) return []
    const zeilen = (ratecards ?? []).filter((r) => r.agenturId === projekt.agenturId).flatMap((r) => r.zeilen)
    return Array.from(new Set(zeilen.map((z) => z.rolle))).filter(Boolean)
  }

  async function addEintrag() {
    if (!ausgewaehlterTag || !form.projektId || !form.rolle.trim()) return
    const stunden = Number(form.stunden.replace(',', '.'))
    if (!stunden || stunden <= 0) return
    await ressourcenplanRepo.add({
      projektId: form.projektId,
      rolle: form.rolle.trim(),
      datum: ausgewaehlterTag,
      geplanteStunden: stunden,
      erstelltAm: new Date().toISOString(),
    })
    setForm(emptyForm())
  }

  async function deleteEintrag(id?: number) {
    if (!id) return
    await ressourcenplanRepo.remove(id)
  }

  return (
    <div>
      <div className="row" style={{ alignItems: 'center', marginBottom: 'var(--s3)' }}>
        <button className="btn ghost small" onClick={() => setMonat((m) => shiftMonth(m, -1))} style={{ flex: 'none' }}>
          ‹
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>
          {new Date(monat.jahr, monat.monat, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
        </div>
        <button className="btn ghost small" onClick={() => setMonat((m) => shiftMonth(m, 1))} style={{ flex: 'none' }}>
          ›
        </button>
      </div>

      <div className="res-cal-grid">
        {WOCHENTAGE.map((w) => (
          <div key={w} className="res-cal-weekday">
            {w}
          </div>
        ))}
      </div>
      <div className="res-cal-grid">
        {tage.map((tag) => {
          const imMonat = new Date(`${tag}T00:00:00`).getMonth() === monat.monat
          const stunden = stundenAmTag(tag)
          const stufe = auslastungsStufe(stunden)
          return (
            <button
              key={tag}
              className={`res-cal-day${imMonat ? '' : ' ausserhalb'}${ausgewaehlterTag === tag ? ' ausgewaehlt' : ''}`}
              onClick={() => setAusgewaehlterTag(tag)}
            >
              <div className="res-cal-daynum">{Number(tag.slice(8, 10))}</div>
              {stunden > 0 && (
                <div className={`res-cal-stunden${stufe !== 'normal' ? ` ${stufe}` : ''}`}>
                  {stunden.toFixed(1)}h
                </div>
              )}
            </button>
          )
        })}
      </div>

      {ausgewaehlterTag && (
        <div className="card stack" style={{ marginTop: 'var(--s4)' }}>
          <div className="list-title">{formatDate(ausgewaehlterTag)}</div>
          {planGefiltert.filter((e) => e.datum === ausgewaehlterTag).length === 0 && (
            <p className="muted">Noch nichts geplant.</p>
          )}
          {planGefiltert
            .filter((e) => e.datum === ausgewaehlterTag)
            .map((e) => (
              <div key={e.id} className="list-item" style={{ cursor: 'default' }}>
                <div>
                  <div className="list-title">
                    {projektName(e.projektId)} · {e.rolle}
                  </div>
                  <div className="list-sub">{e.geplanteStunden} Std. geplant</div>
                </div>
                <button className="icon-btn" onClick={() => deleteEintrag(e.id)} aria-label="Löschen">
                  ✕
                </button>
              </div>
            ))}

          <div className="row">
            <div>
              <label>Projekt</label>
              <select
                className="field"
                value={form.projektId}
                onChange={(e) => setForm((f) => ({ ...f, projektId: e.target.value ? Number(e.target.value) : '' }))}
              >
                <option value="">– auswählen –</option>
                {projekte.map((p) => (
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
                list="res-kal-rollen"
                value={form.rolle}
                onChange={(e) => setForm((f) => ({ ...f, rolle: e.target.value }))}
              />
              <datalist id="res-kal-rollen">
                {rollenOptionen(form.projektId).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div>
              <label>Std.</label>
              <input
                className="field"
                type="number"
                min="0"
                step="0.5"
                value={form.stunden}
                onChange={(e) => setForm((f) => ({ ...f, stunden: e.target.value }))}
              />
            </div>
          </div>
          <button className="btn full" onClick={addEintrag}>
            Hinzufügen
          </button>
        </div>
      )}
    </div>
  )
}
