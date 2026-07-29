import { useNavigate } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { projekteRepo, zeiteintraegeRepo, kvasRepo, ratecardsRepo, kundenRepo } from '../../db/repo'
import { ensureRechnungFuerAbgeschlossenesProjekt } from '../../utils/rechnung'
import { computeKva } from '../../utils/kva'
import { minutenZuStunden } from '../../utils/zeiterfassung'
import PageHeader from '../../layout/PageHeader'

export default function RessourcenPage() {
  const navigate = useNavigate()
  const projekte = useSupabaseQuery(
    ['projekte'],
    async () => (await projekteRepo.list()).filter((p) => p.status === 'ressourcenplanung'),
    [],
  )
  const zeiteintraege = useSupabaseQuery(['zeiteintraege'], () => zeiteintraegeRepo.list(), [])
  const kvas = useSupabaseQuery(['kvas'], () => kvasRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])
  const kunden = useSupabaseQuery(['kunden'], () => kundenRepo.list(), [])

  async function handleBestaetigen(projektId: number) {
    if (!confirm('Stunden bestätigen und Projekt abschließen? Dabei wird automatisch eine Rechnung angelegt.')) {
      return
    }
    await projekteRepo.update(projektId, { status: 'abgeschlossen' })
    const neueRechnungId = await ensureRechnungFuerAbgeschlossenesProjekt(projektId)
    navigate(neueRechnungId ? `/rechnungen/${neueRechnungId}` : '/rechnungen')
  }

  return (
    <div>
      <PageHeader title="Ressourcenplanung" back={false} />
      <p className="muted">
        Projekte mit angenommener KVA. Hier siehst du die bereits erfassten Stunden je Rolle im Vergleich zur
        Kalkulation — nach Bestätigung wechselt das Projekt zu „Abgeschlossen" und die Rechnung wird wie gewohnt
        automatisch angelegt.
      </p>

      <div className="list">
        {projekte?.map((p) => {
          const kunde = kunden?.find((k) => k.id === p.kundeId)
          const kva = kvas?.find((k) => k.projektId === p.id && k.status === 'angenommen')
          const ratecard = ratecards?.find((r) => r.id === kva?.ratecardId)
          const computed = kva ? computeKva(kva, ratecard) : null
          const kalkuliertProRolle = new Map(computed?.rollenAufschluesselung.map((r) => [r.rolle, r.stunden]) ?? [])

          const erfassteMinutenProRolle = new Map<string, number>()
          for (const z of zeiteintraege ?? []) {
            if (z.projektId !== p.id) continue
            erfassteMinutenProRolle.set(z.rolle, (erfassteMinutenProRolle.get(z.rolle) ?? 0) + z.dauerMinuten)
          }
          const rollen = Array.from(new Set([...kalkuliertProRolle.keys(), ...erfassteMinutenProRolle.keys()]))

          return (
            <div key={p.id} className="card stack">
              <div className="list-title">
                {p.name} {kunde && `· ${kunde.name}`}
              </div>
              {rollen.length > 0 ? (
                <table className="calc-table">
                  <thead>
                    <tr>
                      <th>Rolle</th>
                      <th>Erfasst</th>
                      <th>Kalkuliert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollen.map((rolle) => (
                      <tr key={rolle}>
                        <td>{rolle}</td>
                        <td>{minutenZuStunden(erfassteMinutenProRolle.get(rolle) ?? 0).toFixed(1)} Std.</td>
                        <td>{(kalkuliertProRolle.get(rolle) ?? 0).toFixed(1)} Std.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">Noch keine Stunden erfasst und keine angenommene KVA mit Kalkulation gefunden.</p>
              )}
              <button className="btn full" onClick={() => p.id && handleBestaetigen(p.id)}>
                Stunden bestätigen → Rechnung anlegen
              </button>
            </div>
          )
        })}
        {projekte?.length === 0 && <div className="empty">Keine Projekte in der Ressourcenplanung.</div>}
      </div>
    </div>
  )
}
