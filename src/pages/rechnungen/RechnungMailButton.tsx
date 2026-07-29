import { useState } from 'react'
import type { Rechnung, Stammdaten } from '../../db/types'
import { sendGmail } from '../../utils/gmail/send'
import { uint8ArrayToBase64 } from '../../utils/base64'

interface Props {
  rechnung: Rechnung
  stammdaten: Stammdaten
}

// Rechnung direkt aus dem Portal per Mail versenden (Gmail): der Mail-Text
// ist frei editierbar, das Rechnungs-PDF wird automatisch als Anhang erzeugt
// und mitgeschickt. Nutzt denselben Google-Client wie der Kalender-Sync,
// fragt beim ersten Mal zusätzlich den Gmail-Send-Scope an.
export default function RechnungMailButton({ rechnung, stammdaten }: Props) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState(`Rechnung ${rechnung.rechnungsnummer}`)
  const [body, setBody] = useState(
    `Hallo,\n\nanbei die Rechnung ${rechnung.rechnungsnummer}.\n\n${stammdaten.rechnungAbschlusstext}`,
  )
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (!to.trim()) {
      setError('Bitte eine Empfänger-Adresse eintragen.')
      return
    }
    if (!stammdaten.googleClientId.trim()) {
      setError('Bitte zuerst unter Stammdaten eine Google Client-ID hinterlegen (gleiche wie beim Kalender-Sync).')
      return
    }
    setSending(true)
    setError(null)
    try {
      const { buildRechnungPdf } = await import('../../utils/pdf/rechnungPdf')
      const { pdfMake } = await import('../../utils/pdf/setup')
      const docDefinition = await buildRechnungPdf(rechnung, stammdaten)
      const buffer = await pdfMake.createPdf(docDefinition).getBuffer()
      const base64 = uint8ArrayToBase64(new Uint8Array(buffer))

      await sendGmail(stammdaten.googleClientId, {
        to: to.trim(),
        subject,
        body,
        attachment: {
          filename: `${rechnung.rechnungsnummer}.pdf`,
          mimeType: 'application/pdf',
          base64,
        },
      })
      setSent(true)
      setTimeout(() => {
        setOpen(false)
        setSent(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button className="btn ghost full" onClick={() => setOpen(true)}>
        Per E-Mail versenden
      </button>
    )
  }

  return (
    <div className="card stack">
      <div>
        <label>An</label>
        <input className="field" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="empfaenger@firma.de" />
      </div>
      <div>
        <label>Betreff</label>
        <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label>Nachricht</label>
        <textarea className="field" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <p className="muted">Das Rechnungs-PDF wird automatisch als Anhang mitgeschickt.</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn ghost" onClick={() => setOpen(false)} disabled={sending}>
          Abbrechen
        </button>
        <button className="btn" onClick={handleSend} disabled={sending}>
          {sending ? 'Wird gesendet…' : sent ? 'Gesendet ✓' : 'Senden'}
        </button>
      </div>
    </div>
  )
}
