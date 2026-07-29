import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { rechnungenRepo, bewerbungenRepo, zeiteintraegeRepo, todosRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import { rechnungTotals } from '../../utils/rechnung'
import { formatEuro, todayISO } from '../../utils/format'
import { montagDerWoche, minutenZuStunden, kumulierteMinutenFuerTodo, formatDauer } from '../../utils/zeiterfassung'
import type { BewerbungStatus } from '../../db/types'

const bewerbungStatusOrder: BewerbungStatus[] = ['anschreiben_raus', 'call', 'zusage']

const bewerbungStatusLabel: Record<BewerbungStatus, string> = {
  anschreiben_raus: 'Anschreiben raus',
  call: 'Call/Gespräch',
  zusage: 'Zusage',
}

const bewerbungStatusColor: Record<BewerbungStatus, string> = {
  anschreiben_raus: 'orange',
  call: 'yellow',
  zusage: 'green',
}

// Letzte 6 Kalendermonate inkl. dem aktuellen, chronologisch aufsteigend.
function letzteMonate(anzahl: number): { schluessel: string; label: string }[] {
  const heute = new Date()
  const monate: { schluessel: string; label: string }[] = []
  for (let i = anzahl - 1; i >= 0; i--) {
    const d = new Date(heute.getFullYear(), heute.getMonth() - i, 1)
    const schluessel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
    monate.push({ schluessel, label })
  }
  return monate
}

// Letzte `anzahl` Kalenderwochen (Montag–Sonntag) inkl. der aktuellen,
// chronologisch aufsteigend, als Montags-Datum (YYYY-MM-DD) + Kurzlabel.
function letzteWochen(anzahl: number): { montag: string; label: string }[] {
  const heuteMontag = montagDerWoche(todayISO())
  const wochen: { montag: string; label: string }[] = []
  for (let i = anzahl - 1; i >= 0; i--) {
    const d = new Date(`${heuteMontag}T00:00:00`)
    d.setDate(d.getDate() - i * 7)
    const montag = d.toISOString().slice(0, 10)
    const label = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`
    wochen.push({ montag, label })
  }
  return wochen
}

export default function StatistikenPage() {
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])
  const bewerbungen = useSupabaseQuery(['bewerbungen'], () => bewerbungenRepo.list(), [])
  const zeiteintraege = useSupabaseQuery(['zeiteintraege'], () => zeiteintraegeRepo.list(), [])
  const todos = useSupabaseQuery(['todos'], () => todosRepo.list(), [])

  const offenePosten = (rechnungen ?? [])
    .filter((r) => r.zahlungsstatus !== 'bezahlt')
    .reduce((sum, r) => sum + rechnungTotals(r.positionen, r.ustSatz).brutto, 0)

  const gesamtBewerbungen = bewerbungen?.length ?? 0
  const zusagen = (bewerbungen ?? []).filter((b) => b.status === 'zusage').length
  const erfolgsquote = gesamtBewerbungen > 0 ? (zusagen / gesamtBewerbungen) * 100 : 0

  const umsatzProMonat = letzteMonate(6).map((m) => {
    const summe = (rechnungen ?? [])
      .filter((r) => r.zahlungsstatus === 'bezahlt' && r.erstelltAm.slice(0, 7) === m.schluessel)
      .reduce((sum, r) => sum + rechnungTotals(r.positionen, r.ustSatz).brutto, 0)
    return { ...m, summe }
  })
  const maxUmsatz = Math.max(1, ...umsatzProMonat.map((m) => m.summe))

  const stundenProWoche = letzteWochen(8).map((w) => {
    const minuten = (zeiteintraege ?? [])
      .filter((z) => montagDerWoche(z.datum) === w.montag)
      .reduce((sum, z) => sum + z.dauerMinuten, 0)
    return { ...w, stunden: minutenZuStunden(minuten) }
  })
  const maxStunden = Math.max(1, ...stundenProWoche.map((w) => w.stunden))

  const bewerbungCounts = bewerbungStatusOrder.map((status) => ({
    status,
    anzahl: (bewerbungen ?? []).filter((b) => b.status === status).length,
  }))

  // Soll-Ist-Vergleich: erledigte Aufgaben mit geschätzter Zeit gegen die
  // tatsächlich dafür erfassten Minuten (über alle Zeitabschnitte der
  // Aufgabe, siehe kumulierteMinutenFuerTodo) — zeigt, ob die Schätzung
  // realistisch war.
  const sollIstVergleich = (todos ?? [])
    .filter((t) => t.erledigt && t.geschaetzteMinuten > 0)
    .map((t) => {
      const erfasst = kumulierteMinutenFuerTodo(zeiteintraege ?? [], t.id!)
      return { todo: t, erfasst, differenz: erfasst - t.geschaetzteMinuten }
    })
    .sort((a, b) => (a.todo.erstelltAm < b.todo.erstelltAm ? 1 : -1))

  return (
    <div>
      <PageHeader title="Statistiken" />

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-value">{formatEuro(offenePosten)}</div>
          <div className="kpi-label">Offene Posten</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{gesamtBewerbungen > 0 ? `${erfolgsquote.toFixed(0)}%` : '–'}</div>
          <div className="kpi-label">Erfolgsquote Bewerbungen</div>
        </div>
      </div>

      <div className="section-title">Umsatz (bezahlt) · letzte 6 Monate</div>
      <div className="card bar-chart">
        {umsatzProMonat.map((m) => (
          <div className="bar-row" key={m.schluessel}>
            <span className="bar-label">{m.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(m.summe / maxUmsatz) * 100}%` }} />
            </span>
            <span className="bar-value">{formatEuro(m.summe)}</span>
          </div>
        ))}
        {umsatzProMonat.every((m) => m.summe === 0) && (
          <div className="empty">Noch keine bezahlten Rechnungen in diesem Zeitraum.</div>
        )}
      </div>

      <div className="section-title">Auslastung · letzte 8 Wochen</div>
      <div className="card bar-chart">
        {stundenProWoche.map((w) => (
          <div className="bar-row" key={w.montag}>
            <span className="bar-label">{w.label}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${(w.stunden / maxStunden) * 100}%` }} />
            </span>
            <span className="bar-value">{w.stunden.toFixed(1).replace('.', ',')} h</span>
          </div>
        ))}
        {stundenProWoche.every((w) => w.stunden === 0) && (
          <div className="empty">Noch keine erfassten Stunden in diesem Zeitraum.</div>
        )}
      </div>

      <div className="section-title">Bewerbungen nach Status</div>
      <div className="card bar-chart">
        {bewerbungCounts.map((b) => (
          <div className="bar-row" key={b.status}>
            <span className="bar-label">{bewerbungStatusLabel[b.status]}</span>
            <span className="bar-track">
              <span
                className={`bar-fill ${bewerbungStatusColor[b.status]}`}
                style={{ width: `${gesamtBewerbungen > 0 ? (b.anzahl / gesamtBewerbungen) * 100 : 0}%` }}
              />
            </span>
            <span className="bar-value">{b.anzahl}</span>
          </div>
        ))}
        {gesamtBewerbungen === 0 && <div className="empty">Noch keine Bewerbungen erfasst.</div>}
      </div>

      <div className="section-title">Soll-Ist-Vergleich (erledigte Aufgaben)</div>
      <div className="list">
        {sollIstVergleich.map(({ todo, erfasst, differenz }) => (
          <div key={todo.id} className="list-item" style={{ cursor: 'default' }}>
            <div>
              <div className="list-title">{todo.text}</div>
              <div className="list-sub">
                {formatDauer(erfasst)} erfasst · {todo.geschaetzteMinuten} Min. geschätzt
              </div>
            </div>
            <span className={`status-badge ${differenz > 0 ? 'red' : differenz < 0 ? 'green' : 'neutral'}`}>
              {differenz === 0
                ? 'Genau nach Plan'
                : `${differenz > 0 ? '+' : ''}${differenz} Min. ${differenz > 0 ? 'über' : 'unter'} Schätzung`}
            </span>
          </div>
        ))}
        {sollIstVergleich.length === 0 && (
          <div className="empty">Noch keine erledigten Aufgaben mit geschätzter Zeit.</div>
        )}
      </div>
    </div>
  )
}
