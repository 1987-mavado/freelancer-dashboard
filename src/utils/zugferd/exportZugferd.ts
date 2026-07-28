import { PDFDocument, AFRelationship } from 'pdf-lib'
import type { Rechnung, Stammdaten } from '../../db/types'
import { buildRechnungPdf } from '../pdf/rechnungPdf'
import { pdfMake } from '../pdf/setup'
import { buildZugferdXml } from './buildZugferdXml'

export async function exportZugferdPdf(rechnung: Rechnung, stammdaten: Stammdaten) {
  const visualPdfBuffer = await pdfMake.createPdf(buildRechnungPdf(rechnung, stammdaten)).getBuffer()
  const xml = buildZugferdXml(rechnung, stammdaten)

  const pdfDoc = await PDFDocument.load(visualPdfBuffer)
  pdfDoc.setTitle(`ZUGFeRD-Rechnung ${rechnung.rechnungsnummer}`)
  pdfDoc.setSubject('Rechnung')
  if (stammdaten.name.trim()) pdfDoc.setAuthor(stammdaten.name.trim())

  await pdfDoc.attach(new TextEncoder().encode(xml), 'factur-x.xml', {
    mimeType: 'text/xml',
    description: 'Factur-X/ZUGFeRD Invoice XML',
    afRelationship: AFRelationship.Data,
    creationDate: new Date(),
    modificationDate: new Date(),
  })

  const bytes = await pdfDoc.save()
  const blob = new Blob([bytes.slice()], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${rechnung.rechnungsnummer}-zugferd.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
