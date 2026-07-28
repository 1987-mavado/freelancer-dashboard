import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { rechnungenRepo, projekteRepo, getStammdaten } from '../../db/repo'
import type { Rechnung, RechnungPosition, Zahlungsstatus } from '../../db/types'
import PageHeader from '../../layout/PageHeader'
import { generateRechnungsnummer, rechnungTotals } from '../../utils/rechnung'
import { formatEuro, todayISO, addDaysISO, uid } from '../../utils/format'

type EmpfaengerFeld = 'empfaengerName' | 'empfaengerStrasse' | 'empfaengerPlz' | 'empfaengerOrt' | 'empfaengerLand' | 'leitwegId'
type LegacyRechnung = Omit<Rechnung, EmpfaengerFeld> & Partial<Pick<Rechnung, EmpfaengerFeld>>

function withDefaults(r: LegacyRechnung): Rechnung {
  return {
    empfaengerName: '',
    empfaengerStrasse: '',
    empfaengerPlz: '',
    empfaengerOrt: '',
    empfaengerLand: 'DE',
    leitwegId: '',
    ...r,
  }
}

function emptyRechnung(projektId: number, nummer: string): Rechnung {
  return {
    projektId,
    rechnungsnummer: nummer,
    rechnungsanschrift: '',
    lieferanschrift: '',
    empfaengerName: '',
    empfaengerStrasse: '',
    empfaengerPlz: '',
    empfaengerOrt: '',
    empfaengerLand: 'DE',
    leitwegId: '',
    leistungszeitraumVon: todayISO(),
    leistungszeitraumBis: todayISO(),
    positionen: [],
    ustSatz: 19,
    faelligkeitsdatum: addDaysISO(14),
    zahlungsstatus: 'offen',
    erstelltAm: new Date().toISOString(),
  }
}

export default function RechnungDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'neu'
  const rechnungId = isNew ? undefined : Number(id)

  const existing = useSupabaseQuery(
    ['rechnungen'],
    () => (rechnungId ? rechnungenRepo.get(rechnungId) : Promise.resolve(undefined)),
    [rechnungId],
  )
  const projekte = useSupabaseQuery(['projekte'], () => projekteRepo.list(), [])
  const stammdaten = useSupabaseQuery(['stammdaten'], () => getStammdaten(), [])

  const [form, setForm] = useState<Rechnung | null>(null)
  const [setupProjektId, setSetupProjektId] = useState<number | ''>('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingXRechnung, setExportingXRechnung] = useState(false)
  const [exportingZugferd, setExportingZugferd] = useState(false)

  useEffect(() => {
    if (existing) setForm(withDefaults(existing))
  }, [existing])

  async function handleCreate() {
    if (!setupProjektId) return
    const nummer = await generateRechnungsnummer(setupProjektId)
    const rechnung = emptyRechnung(setupProjektId, nummer)
    const newId = await rechnungenRepo.add(rechnung)
    navigate(`/rechnungen/${newId}`, { replace: true })
  }

  async function save(next: Rechnung) {
    setForm(next)
    if (next.id) await rechnungenRepo.put(next as Rechnung & { id: number })
  }

  async function handleDelete() {
    if (!rechnungId) return
    if (!confirm('Rechnung wirklich löschen?')) return
    await rechnungenRepo.remove(rechnungId)
    navigate('/rechnungen', { replace: true })
  }

  if (isNew || !form) {
    return (
      <div>
        <PageHeader title="Neue Rechnung" />
        <div className="stack">
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
          <p className="muted">Die Rechnungsnummer wird automatisch fortlaufend vergeben.</p>
          <button className="btn full" onClick={handleCreate}>
            Anlegen
          </button>
        </div>
      </div>
    )
  }

  const { netto, ustBetrag, brutto } = rechnungTotals(form.positionen, form.ustSatz)

  function addPosition() {
    if (!form) return
    const pos: RechnungPosition = { id: uid(), beschreibung: '', menge: 1, einheit: 'Stk.', einzelpreis: 0 }
    save({ ...form, positionen: [...form.positionen, pos] })
  }

  function updatePosition(pid: string, patch: Partial<RechnungPosition>) {
    if (!form) return
    save({ ...form, positionen: form.positionen.map((p) => (p.id === pid ? { ...p, ...patch } : p)) })
  }

  function removePosition(pid: string) {
    if (!form) return
    save({ ...form, positionen: form.positionen.filter((p) => p.id !== pid) })
  }

  async function handleExportPdf() {
    if (!form || !stammdaten) return
    setExportingPdf(true)
    try {
      const { exportRechnungPdf } = await import('../../utils/pdf/rechnungPdf')
      await exportRechnungPdf(form, stammdaten)
    } finally {
      setExportingPdf(false)
    }
  }

  async function handleExportExcel() {
    if (!form) return
    setExportingExcel(true)
    try {
      const { exportRechnungExcel } = await import('../../utils/excel/rechnungExcel')
      await exportRechnungExcel(form)
    } finally {
      setExportingExcel(false)
    }
  }

  async function handleExportXRechnung() {
    if (!form || !stammdaten) return
    if (!form.empfaengerName.trim() || !form.empfaengerStrasse.trim() || !form.empfaengerPlz.trim() || !form.empfaengerOrt.trim()) {
      alert('Bitte den strukturierten Rechnungsempfänger (Name, Straße, PLZ, Ort) ausfüllen – wird für XRechnung benötigt.')
      return
    }
    if (!stammdaten.strasse.trim() || !stammdaten.plz.trim() || !stammdaten.ort.trim()) {
      alert('Bitte unter Stammdaten die strukturierte Adresse (Straße, PLZ, Ort) ausfüllen – wird für XRechnung benötigt.')
      return
    }
    setExportingXRechnung(true)
    try {
      const { exportXRechnung } = await import('../../utils/xrechnung/buildXRechnung')
      await exportXRechnung(form, stammdaten)
    } finally {
      setExportingXRechnung(false)
    }
  }

  async function handleExportZugferd() {
    if (!form || !stammdaten) return
    if (!form.empfaengerName.trim() || !form.empfaengerStrasse.trim() || !form.empfaengerPlz.trim() || !form.empfaengerOrt.trim()) {
      alert('Bitte den strukturierten Rechnungsempfänger (Name, Straße, PLZ, Ort) ausfüllen – wird für ZUGFeRD benötigt.')
      return
    }
    if (!stammdaten.strasse.trim() || !stammdaten.plz.trim() || !stammdaten.ort.trim()) {
      alert('Bitte unter Stammdaten die strukturierte Adresse (Straße, PLZ, Ort) ausfüllen – wird für ZUGFeRD benötigt.')
      return
    }
    setExportingZugferd(true)
    try {
      const { exportZugferdPdf } = await import('../../utils/zugferd/exportZugferd')
      await exportZugferdPdf(form, stammdaten)
    } finally {
      setExportingZugferd(false)
    }
  }

  return (
    <div>
      <PageHeader title={form.rechnungsnummer} />
      <div className="stack">
        <div className="row">
          <div>
            <label>Rechnungsnummer</label>
            <input className="field" value={form.rechnungsnummer} disabled />
          </div>
          <div>
            <label>Zahlungsstatus</label>
            <select
              className="field"
              value={form.zahlungsstatus}
              onChange={(e) => save({ ...form, zahlungsstatus: e.target.value as Zahlungsstatus })}
            >
              <option value="offen">Offen</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="ueberfaellig">Überfällig</option>
            </select>
          </div>
        </div>

        <div>
          <label>Rechnungsanschrift</label>
          <textarea
            className="field"
            value={form.rechnungsanschrift}
            onChange={(e) => save({ ...form, rechnungsanschrift: e.target.value })}
          />
        </div>
        <div>
          <label>Lieferanschrift</label>
          <textarea
            className="field"
            value={form.lieferanschrift}
            onChange={(e) => save({ ...form, lieferanschrift: e.target.value })}
          />
        </div>

        <div className="section-title">Rechnungsempfänger (strukturiert, für XRechnung)</div>
        <div>
          <label>Name / Firma</label>
          <input
            className="field"
            value={form.empfaengerName}
            onChange={(e) => save({ ...form, empfaengerName: e.target.value })}
          />
        </div>
        <div>
          <label>Straße und Hausnummer</label>
          <input
            className="field"
            value={form.empfaengerStrasse}
            onChange={(e) => save({ ...form, empfaengerStrasse: e.target.value })}
          />
        </div>
        <div className="row">
          <div>
            <label>PLZ</label>
            <input
              className="field"
              value={form.empfaengerPlz}
              onChange={(e) => save({ ...form, empfaengerPlz: e.target.value })}
            />
          </div>
          <div>
            <label>Ort</label>
            <input
              className="field"
              value={form.empfaengerOrt}
              onChange={(e) => save({ ...form, empfaengerOrt: e.target.value })}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label>Land (ISO-Code)</label>
            <input
              className="field"
              value={form.empfaengerLand}
              onChange={(e) => save({ ...form, empfaengerLand: e.target.value.toUpperCase() })}
              placeholder="DE"
              maxLength={2}
            />
          </div>
          <div>
            <label>Leitweg-ID (optional)</label>
            <input
              className="field"
              value={form.leitwegId}
              onChange={(e) => save({ ...form, leitwegId: e.target.value })}
              placeholder="nur für Rechnungen an Behörden"
            />
          </div>
        </div>

        <div className="row">
          <div>
            <label>Leistungszeitraum von</label>
            <input
              className="field"
              type="date"
              value={form.leistungszeitraumVon}
              onChange={(e) => save({ ...form, leistungszeitraumVon: e.target.value })}
            />
          </div>
          <div>
            <label>Leistungszeitraum bis</label>
            <input
              className="field"
              type="date"
              value={form.leistungszeitraumBis}
              onChange={(e) => save({ ...form, leistungszeitraumBis: e.target.value })}
            />
          </div>
        </div>

        <div className="section-title">Positionen</div>
        {form.positionen.map((p) => (
          <div key={p.id} className="card stack">
            <input
              className="field"
              placeholder="Beschreibung"
              value={p.beschreibung}
              onChange={(e) => updatePosition(p.id, { beschreibung: e.target.value })}
            />
            <div className="row">
              <div>
                <label>Menge</label>
                <input
                  className="field"
                  type="number"
                  value={p.menge}
                  onChange={(e) => updatePosition(p.id, { menge: Number(e.target.value) })}
                />
              </div>
              <div>
                <label>Einheit</label>
                <input
                  className="field"
                  value={p.einheit}
                  onChange={(e) => updatePosition(p.id, { einheit: e.target.value })}
                />
              </div>
              <div>
                <label>Einzelpreis</label>
                <input
                  className="field"
                  type="number"
                  value={p.einzelpreis}
                  onChange={(e) => updatePosition(p.id, { einzelpreis: Number(e.target.value) })}
                />
              </div>
            </div>
            <button className="btn ghost small" onClick={() => removePosition(p.id)}>
              Position entfernen
            </button>
          </div>
        ))}
        <button className="btn ghost full" onClick={addPosition}>
          + Position hinzufügen
        </button>

        <div className="row">
          <div>
            <label>USt-Satz (%)</label>
            <input
              className="field"
              type="number"
              value={form.ustSatz}
              onChange={(e) => save({ ...form, ustSatz: Number(e.target.value) })}
            />
          </div>
          <div>
            <label>Fälligkeitsdatum</label>
            <input
              className="field"
              type="date"
              value={form.faelligkeitsdatum}
              onChange={(e) => save({ ...form, faelligkeitsdatum: e.target.value })}
            />
          </div>
        </div>

        <div className="card stack">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">Netto</span>
            <span>{formatEuro(netto)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="muted">USt ({form.ustSatz}%)</span>
            <span>{formatEuro(ustBetrag)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Brutto</span>
            <span>{formatEuro(brutto)}</span>
          </div>
        </div>

        <button className="btn full" onClick={handleExportPdf} disabled={exportingPdf}>
          {exportingPdf ? 'PDF wird erstellt…' : 'Als PDF exportieren'}
        </button>
        <button className="btn ghost full" onClick={handleExportExcel} disabled={exportingExcel}>
          {exportingExcel ? 'Excel wird erstellt…' : 'Als Excel exportieren'}
        </button>
        <button className="btn ghost full" onClick={handleExportXRechnung} disabled={exportingXRechnung}>
          {exportingXRechnung ? 'XRechnung wird erstellt…' : 'Als XRechnung (XML) exportieren'}
        </button>
        <button className="btn ghost full" onClick={handleExportZugferd} disabled={exportingZugferd}>
          {exportingZugferd ? 'ZUGFeRD-PDF wird erstellt…' : 'Als ZUGFeRD-PDF exportieren'}
        </button>

        <button className="btn danger full" onClick={handleDelete}>
          Rechnung löschen
        </button>
      </div>
    </div>
  )
}
