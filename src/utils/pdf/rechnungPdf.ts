import type { Content, TableCell } from 'pdfmake'
import type { Rechnung, Stammdaten } from '../../db/types'
import { formatEuro, formatDate } from '../format'
import { rechnungTotals } from '../rechnung'
import { downloadPdf } from './setup'
import { absenderBlock, absenderZeile, cell, fetchLogoDataUrl, footerBlock, metaTable, pdfStyles } from './shared'

export async function buildRechnungPdf(rechnung: Rechnung, stammdaten: Stammdaten) {
  const { netto, ustBetrag, brutto } = rechnungTotals(rechnung.positionen, rechnung.ustSatz)
  const logoDataUrl = await fetchLogoDataUrl(stammdaten.logoUrl)

  const positionenRows: TableCell[][] = rechnung.positionen.map((p) => [
    cell(p.beschreibung, { style: 'cell' }),
    cell(String(p.menge), { style: 'cell', alignment: 'right' }),
    cell(p.einheit, { style: 'cell' }),
    cell(formatEuro(p.einzelpreis), { style: 'cell', alignment: 'right' }),
    cell(formatEuro(p.menge * p.einzelpreis), { style: 'cell', alignment: 'right' }),
  ])

  const content: Content[] = [
    {
      columns: [
        absenderBlock(stammdaten, logoDataUrl, true),
        {
          width: 'auto',
          stack: [
            { text: absenderZeile(stammdaten), style: 'small', margin: [0, 0, 0, 4] },
            { text: 'Rechnungsanschrift', style: 'label' },
            { text: rechnung.rechnungsanschrift, style: 'cell' },
          ],
        },
      ],
    },
    {
      text: `Rechnung Nr. ${rechnung.rechnungsnummer} vom ${formatDate(rechnung.erstelltAm.slice(0, 10))}`,
      style: 'docTitleCompact',
    },
    {
      columns: [
        metaTable([
          ['Fälligkeitsdatum', formatDate(rechnung.faelligkeitsdatum)],
          ...(rechnung.bestellnummer.trim() ? ([['Bestellnummer', rechnung.bestellnummer]] as [string, string][]) : []),
        ]),
        metaTable([
          ['Leistungszeitraum von', formatDate(rechnung.leistungszeitraumVon)],
          ['Leistungszeitraum bis', formatDate(rechnung.leistungszeitraumBis)],
        ]),
      ],
    },
    {
      margin: [0, 20, 0, 0],
      table: {
        headerRows: 1,
        widths: ['*', 30, 40, 60, 60],
        body: [
          [
            cell('Beschreibung', { style: 'tableHeader' }),
            cell('Menge', { style: 'tableHeader', alignment: 'right' }),
            cell('Einheit', { style: 'tableHeader' }),
            cell('Einzelpreis', { style: 'tableHeader', alignment: 'right' }),
            cell('Gesamt', { style: 'tableHeader', alignment: 'right' }),
          ],
          ...positionenRows,
        ] as TableCell[][],
      },
    },
    {
      margin: [0, 12, 0, 0],
      columns: [
        { width: '*', text: '' },
        {
          width: 'auto',
          table: {
            body: [
              [cell('Netto', { style: 'cell' }), cell(formatEuro(netto), { style: 'cell', alignment: 'right' })],
              [
                cell(`USt (${rechnung.ustSatz}%)`, { style: 'cell' }),
                cell(formatEuro(ustBetrag), { style: 'cell', alignment: 'right' }),
              ],
              [
                cell('Brutto', { style: 'totalLabel' }),
                cell(formatEuro(brutto), { style: 'totalLabel', alignment: 'right' }),
              ],
            ] as TableCell[][],
          },
          layout: 'noBorders',
        },
      ],
    },
  ]

  if (rechnung.lieferanschrift.trim()) {
    content.splice(2, 0, {
      margin: [0, 4, 0, 0],
      stack: [{ text: 'Lieferanschrift', style: 'label' }, { text: rechnung.lieferanschrift, style: 'cell' }],
    })
  }

  if (stammdaten.rechnungAbschlusstext.trim()) {
    content.push({ text: stammdaten.rechnungAbschlusstext, style: 'small', margin: [0, 20, 0, 4] })
  }

  if (stammdaten.zahlungsbedingungen.trim()) {
    content.push({ text: stammdaten.zahlungsbedingungen, style: 'small', margin: [0, 0, 0, 0] })
  }

  return {
    pageSize: 'A4' as const,
    pageMargins: [40, 40, 40, 60] as [number, number, number, number],
    content,
    styles: pdfStyles,
    footer: () => footerBlock(stammdaten),
    defaultStyle: { fontSize: 10 },
  }
}

export async function exportRechnungPdf(rechnung: Rechnung, stammdaten: Stammdaten) {
  await downloadPdf(await buildRechnungPdf(rechnung, stammdaten), `${rechnung.rechnungsnummer}.pdf`)
}
