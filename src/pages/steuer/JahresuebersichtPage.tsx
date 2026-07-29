import { useState } from 'react'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { rechnungenRepo } from '../../db/repo'
import PageHeader from '../../layout/PageHeader'
import { rechnungTotals } from '../../utils/rechnung'
import { formatEuro, formatDate } from '../../utils/format'

const MONATSNAMEN = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

export default function JahresuebersichtPage() {
  const rechnungen = useSupabaseQuery(['rechnungen'], () => rechnungenRepo.list(), [])

  const aktuellesJahr = new Date().getFullYear()
  const [jahr, setJahr] = useState(aktuellesJahr)

  // Auswahlbare Jahre: alle Jahre, in denen mindestens eine bezahlte
  // Rechnung erstellt wurde, plus immer das aktuelle Jahr.
  const verfuegbareJahre = Array.from(
    new Set([
      aktuellesJahr,
      ...(rechnungen ?? [])
        .filter((r) => r.zahlungsstatus === 'bezahlt')
        .map((r) => Number(r.erstelltAm.slice(0, 4))),
    ]),
  ).sort((a, b) => b - a)

  // Diese Übersicht berücksichtigt nur als "bezahlt" markierte Rechnungen
  // (= tatsächliche Einnahmen), gruppiert nach Erstelldatum der Rechnung —
  // ein gesondertes Zahlungsdatum wird aktuell nicht erfasst.
  const bezahlteRechnungenImJahr = (rechnungen ?? [])
    .filter((r) => r.zahlungsstatus === 'bezahlt' && r.erstelltAm.slice(0, 4) === String(jahr))
    .map((r) => ({ rechnung: r, totals: rechnungTotals(r.positionen, r.ustSatz) }))
    .sort((a, b) => (a.rechnung.erstelltAm < b.rechnung.erstelltAm ? -1 : 1))

  const gesamt = bezahlteRechnungenImJahr.reduce(
    (sum, r) => ({
      netto: sum.netto + r.totals.netto,
      ustBetrag: sum.ustBetrag + r.totals.ustBetrag,
      brutto: sum.brutto + r.totals.brutto,
    }),
    { netto: 0, ustBetrag: 0, brutto: 0 },
  )

  const proMonat = MONATSNAMEN.map((name, i) => {
    const rechnungenDesMonats = bezahlteRechnungenImJahr.filter(
      (r) => Number(r.rechnung.erstelltAm.slice(5, 7)) - 1 === i,
    )
    const summe = rechnungenDesMonats.reduce(
      (sum, r) => ({
        netto: sum.netto + r.totals.netto,
        ustBetrag: sum.ustBetrag + r.totals.ustBetrag,
        brutto: sum.brutto + r.totals.brutto,
      }),
      { netto: 0, ustBetrag: 0, brutto: 0 },
    )
    return { name, ...summe }
  })

  return (
    <div>
      <PageHeader title="Jahresübersicht" />
      <p className="muted">
        Übersicht der als „bezahlt" markierten Rechnungen für die jährliche Steuererklärung — z.B. zum Weitergeben
        an deinen Steuerberater. Ersetzt keine Steuerberatung; Ausgaben werden hier nicht erfasst.
      </p>

      <div style={{ marginBottom: 'var(--s4)' }}>
        <label>Jahr</label>
        <select className="field" value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
          {verfuegbareJahre.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <div className="kpi">
          <div className="kpi-value">{formatEuro(gesamt.netto)}</div>
          <div className="kpi-label">Netto gesamt</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{formatEuro(gesamt.ustBetrag)}</div>
          <div className="kpi-label">USt. gesamt</div>
        </div>
        <div className="kpi">
          <div className="kpi-value">{formatEuro(gesamt.brutto)}</div>
          <div className="kpi-label">Brutto gesamt</div>
        </div>
      </div>

      <div className="section-title">Pro Monat</div>
      <div className="card">
        <table className="calc-table">
          <thead>
            <tr>
              <th>Monat</th>
              <th>Netto</th>
              <th>USt.</th>
              <th>Brutto</th>
            </tr>
          </thead>
          <tbody>
            {proMonat.map((m) => (
              <tr key={m.name}>
                <td>{m.name}</td>
                <td>{formatEuro(m.netto)}</td>
                <td>{formatEuro(m.ustBetrag)}</td>
                <td>{formatEuro(m.brutto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-title">Bezahlte Rechnungen {jahr}</div>
      <div className="card">
        {bezahlteRechnungenImJahr.length === 0 && (
          <div className="empty">Keine bezahlten Rechnungen in diesem Jahr.</div>
        )}
        {bezahlteRechnungenImJahr.length > 0 && (
          <table className="calc-table">
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Datum</th>
                <th>Netto</th>
                <th>USt.</th>
                <th>Brutto</th>
              </tr>
            </thead>
            <tbody>
              {bezahlteRechnungenImJahr.map(({ rechnung, totals }) => (
                <tr key={rechnung.id}>
                  <td>{rechnung.rechnungsnummer}</td>
                  <td>{formatDate(rechnung.erstelltAm)}</td>
                  <td>{formatEuro(totals.netto)}</td>
                  <td>{formatEuro(totals.ustBetrag)}</td>
                  <td>{formatEuro(totals.brutto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
