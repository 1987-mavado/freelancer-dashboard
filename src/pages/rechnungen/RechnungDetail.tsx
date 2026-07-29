import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSupabaseQuery } from '../../db/useSupabaseQuery'
import { rechnungenRepo, projekteRepo, kundenRepo, getStammdaten, zeiteintraegeRepo, ratecardsRepo } from '../../db/repo'
import type { Rechnung, RechnungPosition, Zahlungsstatus } from '../../db/types'
import PageHeader from '../../layout/PageHeader'
import { emptyRechnung, generateRechnungsnummer, rechnungTotals } from '../../utils/rechnung'
import { formatEuro, uid } from '../../utils/format'
import { rateFor } from '../../utils/kva'
import { formatDauer, minutenZuStunden } from '../../utils/zeiterfassung'

type LegacyFeld = 'empfaengerName' | 'empfaengerStrasse' | 'empfaengerPlz' | 'empfaengerOrt' | 'empfaengerLand' | 'leitwegId' | 'bestellnummer' | 'taetigkeit'
type LegacyRechnung = Omit<Rechnung, LegacyFeld> & Partial<Pick<Rechnung, LegacyFeld>>

function withDefaults(r: LegacyRechnung): Rechnung {
  return {
    empfaengerName: '',
    empfaengerStrasse: '',
    empfaengerPlz: '',
    empfaengerOrt: '',
    empfaengerLand: 'DE',
    leitwegId: '',
    bestellnummer: '',
    taetigkeit: '',
    ...r,
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
  const kunden = useSupabaseQuery(['kunden'], () => kundenRepo.list(), [])
  const stammdaten = useSupabaseQuery(['stammdaten'], () => getStammdaten(), [])
  const zeiteintraege = useSupabaseQuery(['zeiteintraege'], () => zeiteintraegeRepo.list(), [])
  const ratecards = useSupabaseQuery(['ratecards'], () => ratecardsRepo.list(), [])

  const [form, setForm] = useState<Rechnung | null>(null)
  const [setupProjektId, setSetupProjektId] = useState<number | ''>('')
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingXRechnung, setExportingXRechnung] = useState(false)
  const [exportingZugferd, setExportingZugferd] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  // Reines UI-Hilfsfeld (nicht in der DB gespeichert): die Lieferanschrift
  // ist optional und wird nur benötigt, wenn sie von der (Pflicht-)
  // Rechnungsanschrift abweicht. Das Eingabefeld wird daher nur angezeigt,
  // wenn diese Checkbox aktiviert ist; beim Deaktivieren wird der Wert
  // geleert, damit auf dem PDF keine veraltete/versteckte Lieferanschrift
  // hängen bleibt.
  const [lieferanschriftAbweichend, setLieferanschriftAbweichend] = useState(false)

  // `existing` kommt aus useSupabaseQuery und wird nicht nur beim Laden neu
  // geliefert, sondern auch jedes Mal, wenn `save()` unten selbst schreibt
  // (put() ruft notify('rechnungen') auf, das lauscht auch diese Komponente).
  // Ohne die loadedRechnungIdRef-Sperre würde also jeder eigene Speichervorgang
  // kurz danach den lokalen `form`-State mit der Serverantwort überschreiben
  // — genau der Bug, der zuvor bei KVAs Eingaben verschwinden ließ (siehe
  // KvaDetail.tsx). Deshalb wird `form` nur einmal pro Rechnungs-ID aus
  // `existing` befüllt, nicht bei jedem Refetch.
  const loadedRechnungIdRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (existing && loadedRechnungIdRef.current !== rechnungId) {
      const merged = withDefaults(existing)
      setForm(merged)
      setLieferanschriftAbweichend(!!merged.lieferanschrift.trim())
      loadedRechnungIdRef.current = rechnungId
    }
  }, [existing, rechnungId])

  // Reihenfolge der Speicheraufrufe kann durcheinandergeraten (schnelles
  // Tippen feuert je Änderung einen eigenen put()-Aufruf); saveSeqRef sorgt
  // dafür, dass nur der zuletzt gestartete Aufruf den Anzeigestatus setzt.
  const saveSeqRef = useRef(0)

  async function handleCreate() {
    if (!setupProjektId) return
    const nummer = await generateRechnungsnummer(setupProjektId)
    const rechnung = emptyRechnung(setupProjektId, nummer)
    const newId = await rechnungenRepo.add(rechnung)
    navigate(`/rechnungen/${newId}`, { replace: true })
  }

  async function save(next: Rechnung) {
    setForm(next)
    if (!next.id) return
    const seq = ++saveSeqRef.current
    setSaveState('saving')
    try {
      await rechnungenRepo.put(next as Rechnung & { id: number })
      if (seq === saveSeqRef.current) setSaveState('saved')
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Rechnung speichern fehlgeschlagen', err)
      if (seq === saveSeqRef.current) setSaveState('error')
    }
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

  const aktuellesProjekt = projekte?.find((p) => p.id === form.projektId)
  const aktuellerKunde = kunden?.find((k) => k.id === aktuellesProjekt?.kundeId)
  const titel = ['Rechnung', form.rechnungsnummer, aktuellerKunde?.name, form.taetigkeit.trim()]
    .filter((t) => !!t && t.trim().length > 0)
    .join(' – ')

  // Noch nicht abgerechnete Zeiteinträge zum Projekt dieser Rechnung — Basis
  // für den "Zeiterfassung übernehmen"-Button unten bei den Positionen.
  const offeneZeiteintraege = (zeiteintraege ?? []).filter(
    (z) => z.projektId === form.projektId && !z.abgerechnet && !z.laeuft,
  )
  const offeneMinutenGesamt = offeneZeiteintraege.reduce((sum, z) => sum + z.dauerMinuten, 0)

  async function handleUebernehmenZeiterfassung() {
    if (!form || offeneZeiteintraege.length === 0) return
    const projekt = projekte?.find((p) => p.id === form.projektId)
    const projektRatecards = (ratecards ?? []).filter((r) => r.agenturId === projekt?.agenturId)

    const minutenProRolle = new Map<string, number>()
    for (const z of offeneZeiteintraege) {
      minutenProRolle.set(z.rolle, (minutenProRolle.get(z.rolle) ?? 0) + z.dauerMinuten)
    }
    const zeilen = Array.from(minutenProRolle.entries()).map(([rolle, minuten]) => {
      const stunden = Math.round(minutenZuStunden(minuten) * 100) / 100
      const satz = projektRatecards.map((rc) => rateFor(rc, rolle)).find((r) => r > 0) ?? 0
      return { rolle, stunden, satz }
    })

    const fehlendeSaetze = zeilen.filter((z) => z.satz === 0).map((z) => z.rolle)
    const summary = zeilen.map((z) => `${z.rolle}: ${z.stunden} Std. × ${formatEuro(z.satz)}`).join('\n')
    const warnung = fehlendeSaetze.length
      ? `\n\nAchtung: Für „${fehlendeSaetze.join('“, „')}“ wurde kein Stundensatz in einer Ratecard dieser Agentur gefunden — Einzelpreis wird mit 0,00 € übernommen und muss manuell ergänzt werden.`
      : ''
    if (!confirm(`Folgende offene Zeiteinträge als Positionen übernehmen?\n\n${summary}${warnung}`)) return

    const neuePositionen: RechnungPosition[] = zeilen.map((z) => ({
      id: uid(),
      beschreibung: `Zeiterfassung: ${z.rolle}`,
      menge: z.stunden,
      einheit: 'Std.',
      einzelpreis: z.satz,
    }))
    const next = { ...form, positionen: [...form.positionen, ...neuePositionen] }
    await save(next)
    await Promise.all(
      offeneZeiteintraege.map((z) => zeiteintraegeRepo.update(z.id!, { abgerechnet: true, rechnungId: form.id })),
    )
  }

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
      <PageHeader
        title={titel}
        action={
          <div className="row" style={{ alignItems: 'center', gap: 'var(--s2)' }}>
            {saveState === 'saving' && <span className="muted">Speichert…</span>}
            {saveState === 'saved' && <span className="muted">Gespeichert</span>}
            {saveState === 'error' && <span className="error">Fehler beim Speichern</span>}
          </div>
        }
      />
      <div className="stack">
        <div className="row">
          <div>
            <label>Rechnungsnummer</label>
            <input
              className="field"
              value={form.rechnungsnummer}
              onChange={(e) => save({ ...form, rechnungsnummer: e.target.value })}
            />
          </div>
          <div>
            <label>Bestellnummer (optional)</label>
            <input
              className="field"
              value={form.bestellnummer}
              onChange={(e) => save({ ...form, bestellnummer: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label>Tätigkeit</label>
          <input
            className="field"
            value={form.taetigkeit}
            onChange={(e) => save({ ...form, taetigkeit: e.target.value })}
            placeholder="z.B. Konzeption Markenauftritt"
          />
          <p className="muted">Erscheint in der Überschrift: „{titel}"</p>
        </div>

        <div className="row">
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
        <div className="checkbox-row">
          <input
            type="checkbox"
            checked={lieferanschriftAbweichend}
            onChange={(e) => {
              const checked = e.target.checked
              setLieferanschriftAbweichend(checked)
              if (!checked) save({ ...form, lieferanschrift: '' })
            }}
          />
          <span className="muted">Lieferanschrift weicht ab</span>
        </div>
        {lieferanschriftAbweichend && (
          <div>
            <label>Lieferanschrift</label>
            <textarea
              className="field"
              value={form.lieferanschrift}
              onChange={(e) => save({ ...form, lieferanschrift: e.target.value })}
            />
          </div>
        )}

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
        {offeneZeiteintraege.length > 0 && (
          <button className="btn ghost full" onClick={handleUebernehmenZeiterfassung}>
            Zeiterfassung übernehmen ({formatDauer(offeneMinutenGesamt)} offen)
          </button>
        )}
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
