import { useEffect, useState } from 'react'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { zeiteintraegeRepo, projekteRepo, ratecardsRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import { formatDate, todayISO } from '../../utils/format'
import { starteTimer, stoppeTimer, formatDauer, formatVerstrichen } from '../../utils/zeiterfassung'

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

export default function ZeiterfassungPage() {
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

  const laufender = zeiteintraege?.find((z) => z.laeuft)

  const [timerProjektId, setTimerProjektId] = useState<number | ''>('')
  const [timerRolle, setTimerRolle] = useState('')
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)

  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState<ManualForm>(emptyManual())

  // Erzwingt jede Sekunde ein Re-Render, solange ein Timer läuft, damit die
  // Live-Anzeige (formatVerstrichen) hochzählt — der Wert selbst wird bei
  // jedem Render direkt aus `startZeit` neu berechnet, nicht aus diesem State.
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!laufender) return
    const iv = window.setInterval(() => forceTick((t) => t + 1), 1000)
    return () => clearInterval(iv)
  }, [laufender])

  function projektName(id?: number) {
    return projekte?.find((p) => p.id === id)?.name ?? '–'
  }

  function rollenOptionen(projektId: number | '') {
    const projekt = projekte?.find((p) => p.id === projektId)
    if (!projekt?.agenturId) return []
    const zeilen = (ratecards ?? []).filter((r) => r.agenturId === projekt.agenturId).flatMap((r) => r.zeilen)
    return Array.from(new Set(zeilen.map((z) => z.rolle))).filter(Boolean)
  }

  async function handleStart() {
    if (!timerProjektId || !timerRolle.trim()) return
    setStarting(true)
    try {
      await starteTimer(timerProjektId, timerRolle.trim())
      setTimerProjektId('')
      setTimerRolle('')
    } finally {
      setStarting(false)
    }
  }

  async function handleStop() {
    if (!laufender) return
    setStopping(true)
    try {
      await stoppeTimer(laufender)
    } finally {
      setStopping(false)
    }
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
      erstelltAm: new Date().toISOString(),
    })
    setManual(emptyManual())
    setManualOpen(false)
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm('Zeiteintrag wirklich löschen?')) return
    await zeiteintraegeRepo.remove(id)
  }

  const elapsedSeconds = laufender?.startZeit
    ? Math.floor((Date.now() - new Date(laufender.startZeit).getTime()) / 1000)
    : 0

  const abgeschlosseneEintraege = zeiteintraege?.filter((z) => !z.laeuft) ?? []

  return (
    <div>
      <PageHeader title="Zeiterfassung" back={false} />

      <div className="card">
        {laufender ? (
          <>
            <div className="timer-mode">
              Läuft · {projektName(laufender.projektId)} · {laufender.rolle}
            </div>
            <div className="timer-display">{formatVerstrichen(elapsedSeconds)}</div>
            <div className="row">
              <button className="btn" onClick={handleStop} disabled={stopping}>
                {stopping ? 'Wird gestoppt…' : 'Stoppen'}
              </button>
            </div>
          </>
        ) : (
          <div className="stack">
            <div>
              <label>Projekt</label>
              <select
                className="field"
                value={timerProjektId}
                onChange={(e) => setTimerProjektId(e.target.value ? Number(e.target.value) : '')}
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
                list="timer-rollen"
                value={timerRolle}
                onChange={(e) => setTimerRolle(e.target.value)}
                placeholder="z.B. Creative Director"
              />
              <datalist id="timer-rollen">
                {rollenOptionen(timerProjektId).map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <button className="btn full" onClick={handleStart} disabled={starting}>
              {starting ? 'Wird gestartet…' : 'Timer starten'}
            </button>
          </div>
        )}
      </div>

      <div className="section-title">Einträge</div>
      <div className="list">
        {abgeschlosseneEintraege.map((z) => (
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
              <button className="icon-btn" onClick={() => handleDelete(z.id)} aria-label="Löschen">
                ✕
              </button>
            </div>
          </div>
        ))}
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
