import ExcelJS from 'exceljs'
import type { Rechnung } from '../../db/types'
import { formatDate } from '../format'
import { rechnungTotals } from '../rechnung'
import { downloadWorkbook, EUR_FORMAT } from './setup'

export function buildRechnungWorkbook(rechnung: Rechnung) {
  const { netto, ustBetrag, brutto } = rechnungTotals(rechnung.positionen, rechnung.ustSatz)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Rechnung')

  sheet.columns = [
    { key: 'a', width: 32 },
    { key: 'b', width: 12 },
    { key: 'c', width: 12 },
    { key: 'd', width: 14 },
    { key: 'e', width: 14 },
  ]

  sheet.addRow(['Rechnungsnummer', rechnung.rechnungsnummer])
  sheet.addRow(['Rechnungsdatum', formatDate(rechnung.erstelltAm.slice(0, 10))])
  sheet.addRow(['Fälligkeitsdatum', formatDate(rechnung.faelligkeitsdatum)])
  sheet.addRow([
    'Leistungszeitraum',
    `${formatDate(rechnung.leistungszeitraumVon)} – ${formatDate(rechnung.leistungszeitraumBis)}`,
  ])
  sheet.addRow([])

  sheet.addRow(['Beschreibung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt']).font = { bold: true }

  // "Gesamt" je Position als echte Formel (Menge * Einzelpreis), damit die
  // Excel-Datei nicht nur eingefrorene Werte enthält, sondern bei manueller
  // Anpassung von Menge/Preis im Excel selbst neu rechnet.
  let firstItemRow: number | null = null
  let lastItemRow = 0
  for (const p of rechnung.positionen) {
    const row = sheet.addRow([p.beschreibung, p.menge, p.einheit, p.einzelpreis, undefined])
    const r = row.number
    row.getCell(5).value = { formula: `B${r}*D${r}`, result: p.menge * p.einzelpreis }
    row.getCell(4).numFmt = EUR_FORMAT
    row.getCell(5).numFmt = EUR_FORMAT
    if (firstItemRow === null) firstItemRow = r
    lastItemRow = r
  }
  sheet.addRow([])

  const nettoRow = sheet.addRow(['Netto', '', '', '', undefined])
  nettoRow.getCell(5).value =
    firstItemRow !== null
      ? { formula: `SUM(E${firstItemRow}:E${lastItemRow})`, result: netto }
      : 0
  nettoRow.getCell(5).numFmt = EUR_FORMAT
  const nettoRowNum = nettoRow.number

  const ustRow = sheet.addRow([`USt (${rechnung.ustSatz}%)`, '', '', '', undefined])
  ustRow.getCell(5).value = { formula: `E${nettoRowNum}*${rechnung.ustSatz}/100`, result: ustBetrag }
  ustRow.getCell(5).numFmt = EUR_FORMAT
  const ustRowNum = ustRow.number

  const bruttoRow = sheet.addRow(['Brutto', '', '', '', undefined])
  bruttoRow.font = { bold: true }
  bruttoRow.getCell(5).value = { formula: `E${nettoRowNum}+E${ustRowNum}`, result: brutto }
  bruttoRow.getCell(5).numFmt = EUR_FORMAT

  return workbook
}

export async function exportRechnungExcel(rechnung: Rechnung) {
  await downloadWorkbook(buildRechnungWorkbook(rechnung), `${rechnung.rechnungsnummer}.xlsx`)
}
