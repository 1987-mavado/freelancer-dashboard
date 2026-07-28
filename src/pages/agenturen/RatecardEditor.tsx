import { useState } from 'react'
import { ratecardsRepo } from '../../db/repo'
import type { Ratecard, RatecardZeile } from '../../db/types'
import { formatEuro, uid } from '../../utils/format'

function emptyRatecard(agenturId: number): Ratecard {
  return { agenturId, bezeichnung: '', reduktionProzent: undefined, zeilen: [] }
}

export default function RatecardEditor({
  agenturId,
  ratecards,
}: {
  agenturId: number
  ratecards: Ratecard[]
}) {
  const [editing, setEditing] = useState<Ratecard | null>(null)

  async function handleSave() {
    if (!editing || !editing.bezeichnung.trim()) return
    if (editing.id) {
      await ratecardsRepo.put(editing as Ratecard & { id: number })
    } else {
      await ratecardsRepo.add(editing)
    }
    setEditing(null)
  }

  async function handleDelete(id?: number) {
    if (!id) return
    if (!confirm('Ratecard löschen?')) return
    await ratecardsRepo.remove(id)
  }

  function addZeile() {
    if (!editing) return
    const zeile: RatecardZeile = { id: uid(), rolle: '', stundensatz: 0, tagessatz: 0 }
    setEditing({ ...editing, zeilen: [...editing.zeilen, zeile] })
  }

  function updateZeile(zid: string, patch: Partial<RatecardZeile>) {
    if (!editing) return
    setEditing({
      ...editing,
      zeilen: editing.zeilen.map((z) => (z.id === zid ? { ...z, ...patch } : z)),
    })
  }

  function removeZeile(zid: string) {
    if (!editing) return
    setEditing({ ...editing, zeilen: editing.zeilen.filter((z) => z.id !== zid) })
  }

  if (editing) {
    return (
      <div className="card stack">
        <div>
          <label>Bezeichnung / Version</label>
          <input
            className="field"
            value={editing.bezeichnung}
            onChange={(e) => setEditing({ ...editing, bezeichnung: e.target.value })}
            placeholder="z.B. Standard 2026"
          />
        </div>
        <div>
          <label>Reduktion (%) — optional</label>
          <input
            className="field"
            type="number"
            value={editing.reduktionProzent ?? ''}
            onChange={(e) =>
              setEditing({
                ...editing,
                reduktionProzent: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>

        <div className="stack">
          {editing.zeilen.map((z) => (
            <div key={z.id} className="row" style={{ alignItems: 'flex-end' }}>
              <div>
                <label>Rolle</label>
                <input
                  className="field"
                  value={z.rolle}
                  onChange={(e) => updateZeile(z.id, { rolle: e.target.value })}
                />
              </div>
              <div>
                <label>Std.-Satz</label>
                <input
                  className="field"
                  type="number"
                  value={z.stundensatz}
                  onChange={(e) => updateZeile(z.id, { stundensatz: Number(e.target.value) })}
                />
              </div>
              <div>
                <label>Tagessatz</label>
                <input
                  className="field"
                  type="number"
                  value={z.tagessatz}
                  onChange={(e) => updateZeile(z.id, { tagessatz: Number(e.target.value) })}
                />
              </div>
              <button className="icon-btn" onClick={() => removeZeile(z.id)} aria-label="Zeile entfernen">
                ✕
              </button>
            </div>
          ))}
          <button className="btn ghost small" onClick={addZeile}>
            + Rolle hinzufügen
          </button>
        </div>

        <div className="row">
          <button className="btn ghost" onClick={() => setEditing(null)}>
            Abbrechen
          </button>
          <button className="btn" onClick={handleSave}>
            Speichern
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      {ratecards.map((rc) => (
        <div key={rc.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="list-title">
                {rc.bezeichnung}
                {rc.reduktionProzent ? ` (−${rc.reduktionProzent}%)` : ''}
              </div>
              <div className="list-sub">{rc.zeilen.length} Rolle(n)</div>
            </div>
            <div className="row" style={{ flex: 'none', gap: 'var(--s2)' }}>
              <button className="btn ghost small" onClick={() => setEditing(rc)}>
                Bearbeiten
              </button>
              <button className="btn danger small" onClick={() => handleDelete(rc.id)}>
                Löschen
              </button>
            </div>
          </div>
          {rc.zeilen.length > 0 && (
            <table className="calc-table" style={{ marginTop: 'var(--s3)' }}>
              <thead>
                <tr>
                  <th>Rolle</th>
                  <th>Std.-Satz</th>
                  <th>Tagessatz</th>
                </tr>
              </thead>
              <tbody>
                {rc.zeilen.map((z) => (
                  <tr key={z.id}>
                    <td>{z.rolle}</td>
                    <td>{formatEuro(z.stundensatz)}</td>
                    <td>{formatEuro(z.tagessatz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      <button className="btn ghost full" onClick={() => setEditing(emptyRatecard(agenturId))}>
        + Neue Ratecard
      </button>
    </div>
  )
}
