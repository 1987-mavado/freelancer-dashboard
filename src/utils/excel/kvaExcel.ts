import ExcelJS from 'exceljs'
import type { Kva, Projekt, Ratecard } from '../../db/types'
import { computeKva, rateFor } from '../kva'
import { downloadWorkbook, EUR_FORMAT } from './setup'

export function buildKvaWorkbook(
  kva: Kva,
  ratecard: Ratecard | undefined,
  projekt: Projekt | undefined,
  kundeName: string,
) {
  const computed = computeKva(kva, ratecard)
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('KVA')

  sheet.columns = [{ key: 'a', width: 28 }, { key: 'b', width: 14 }, { key: 'c', width: 14 }, { key: 'd', width: 14 }]

  sheet.addRow(['Bezeichnung', kva.bezeichnung || '–'])
  sheet.addRow(['Projekt', projekt?.name ?? '–'])
  sheet.addRow(['Kunde', kundeName || '–'])
  sheet.addRow([])

  // Detailzeilen je Phase als echte Formeln (Stunden * Std.-Satz), damit die
  // Excel-Datei bei manueller Anpassung im Excel selbst neu rechnet. Wir
  // merken uns die Zeilenspanne über alle Phasen hinweg, damit die
  // Aufschlüsselung nach Rolle darauf per SUMIF referenzieren kann.
  let firstDataRow: number | null = null
  let lastDataRow = 0
  for (const phase of kva.phasen) {
    sheet.addRow([phase.bezeichnung || '(ohne Titel)']).font = { bold: true, size: 12 }
    sheet.addRow(['Rolle', 'Stunden', 'Std.-Satz', 'Summe']).font = { bold: true }
    for (const z of phase.zeilen) {
      const satz = rateFor(ratecard, z.rolle)
      const row = sheet.addRow([z.rolle, z.stunden, satz, undefined])
      const r = row.number
      row.getCell(4).value = { formula: `B${r}*C${r}`, result: satz * z.stunden }
      row.getCell(3).numFmt = EUR_FORMAT
      row.getCell(4).numFmt = EUR_FORMAT
      if (firstDataRow === null) firstDataRow = r
      lastDataRow = r
    }
    sheet.addRow([])
  }

  sheet.addRow(['Aufschlüsselung nach Rolle']).font = { bold: true, size: 12 }
  sheet.addRow(['Rolle', 'Stunden', 'Summe']).font = { bold: true }
  let breakdownFirstRow: number | null = null
  let breakdownLastRow = 0
  for (const r of computed.rollenAufschluesselung) {
    const row = sheet.addRow([r.rolle, undefined, undefined])
    const rn = row.number
    if (firstDataRow !== null) {
      row.getCell(2).value = {
        formula: `SUMIF(A${firstDataRow}:A${lastDataRow},A${rn},B${firstDataRow}:B${lastDataRow})`,
        result: r.stunden,
      }
      row.getCell(3).value = {
        formula: `SUMIF(A${firstDataRow}:A${lastDataRow},A${rn},D${firstDataRow}:D${lastDataRow})`,
        result: r.summe,
      }
    } else {
      row.getCell(2).value = r.stunden
      row.getCell(3).value = r.summe
    }
    row.getCell(3).numFmt = EUR_FORMAT
    if (breakdownFirstRow === null) breakdownFirstRow = rn
    breakdownLastRow = rn
  }
  sheet.addRow([])

  const totalRow = sheet.addRow(['Gesamtsumme (netto)', '', '', undefined])
  totalRow.font = { bold: true }
  totalRow.getCell(4).value =
    breakdownFirstRow !== null
      ? { formula: `SUM(C${breakdownFirstRow}:C${breakdownLastRow})`, result: computed.gesamtsumme }
      : 0
  totalRow.getCell(4).numFmt = EUR_FORMAT

  return workbook
}

export async function exportKvaExcel(
  kva: Kva,
  ratecard: Ratecard | undefined,
  projekt: Projekt | undefined,
  kundeName: string,
) {
  const filename = `KVA-${(kva.bezeichnung || 'unbenannt').replace(/[^\w-]+/g, '_')}.xlsx`
  await downloadWorkbook(buildKvaWorkbook(kva, ratecard, projekt, kundeName), filename)
}
