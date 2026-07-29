import type { Content, TableCell } from 'pdfmake'
import type { Kva, Projekt, Ratecard, Stammdaten } from '../../db/types'
import { formatEuro, formatDate } from '../format'
import { computeKva, rateFor } from '../kva'
import { downloadPdf } from './setup'
import { absenderBlock, absenderZeile, cell, fetchLogoDataUrl, footerBlock, metaTable, pdfStyles } from './shared'

export async function buildKvaPdf(
  kva: Kva,
  ratecard: Ratecard | undefined,
  projekt: Projekt | undefined,
  kundeName: string,
  stammdaten: Stammdaten,
) {
  const computed = computeKva(kva, ratecard)
  const logoDataUrl = await fetchLogoDataUrl(stammdaten.logoUrl)

  const phasenContent: Content[] = kva.phasen.flatMap((phase): Content[] => [
    { text: phase.bezeichnung || '(ohne Titel)', style: 'sectionTitle' },
    ...(phase.beschreibung.trim() ? [{ text: phase.beschreibung, style: 'cell', margin: [0, 0, 0, 6] } as Content] : []),
    {
      table: {
        headerRows: 1,
        widths: ['*', 60, 60, 70],
        body: [
          [
            cell('Rolle', { style: 'tableHeader' }),
            cell('Stunden', { style: 'tableHeader', alignment: 'right' }),
            cell('Std.-Satz', { style: 'tableHeader', alignment: 'right' }),
            cell('Summe', { style: 'tableHeader', alignment: 'right' }),
          ],
          ...phase.zeilen.map((z): TableCell[] => {
            const satz = rateFor(ratecard, z.rolle)
            return [
              cell(z.rolle, { style: 'cell' }),
              cell(String(z.stunden), { style: 'cell', alignment: 'right' }),
              cell(formatEuro(satz), { style: 'cell', alignment: 'right' }),
              cell(formatEuro(satz * z.stunden), { style: 'cell', alignment: 'right' }),
            ]
          }),
        ] as TableCell[][],
      },
    },
  ])

  const content: Content[] = [
    {
      columns: [
        absenderBlock(stammdaten, logoDataUrl),
        {
          width: 'auto',
          stack: [
            { text: absenderZeile(stammdaten), style: 'small', margin: [0, 0, 0, 4] },
            { text: 'Kunde', style: 'label' },
            { text: kundeName || '–', style: 'cell' },
          ],
        },
      ],
    },
    { text: 'KOSTENVORANSCHLAG', style: 'docTitle' },
    metaTable([
      ['Bezeichnung', kva.bezeichnung || '–'],
      ['Projekt', projekt?.name ?? '–'],
      ['Datum', formatDate(kva.erstelltAm.slice(0, 10))],
    ]),
    ...phasenContent,
    { text: 'Aufschlüsselung nach Rolle', style: 'sectionTitle' },
    {
      table: {
        headerRows: 1,
        widths: ['*', 60, 70],
        body: [
          [
            cell('Rolle', { style: 'tableHeader' }),
            cell('Stunden', { style: 'tableHeader', alignment: 'right' }),
            cell('Summe', { style: 'tableHeader', alignment: 'right' }),
          ],
          ...computed.rollenAufschluesselung.map(
            (r): TableCell[] => [
              cell(r.rolle, { style: 'cell' }),
              cell(String(r.stunden), { style: 'cell', alignment: 'right' }),
              cell(formatEuro(r.summe), { style: 'cell', alignment: 'right' }),
            ],
          ),
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
              [
                cell('Gesamtsumme (netto)', { style: 'totalLabel' }),
                cell(formatEuro(computed.gesamtsumme), { style: 'totalLabel', alignment: 'right' }),
              ],
            ] as TableCell[][],
          },
          layout: 'noBorders',
        },
      ],
    },
    { text: 'Alle Preise verstehen sich netto zzgl. gesetzlicher USt.', style: 'small', margin: [0, 20, 0, 0] },
  ]

  return {
    pageSize: 'A4' as const,
    pageMargins: [40, 40, 40, 60] as [number, number, number, number],
    content,
    styles: pdfStyles,
    footer: () => footerBlock(stammdaten),
    defaultStyle: { fontSize: 10 },
  }
}

export async function exportKvaPdf(
  kva: Kva,
  ratecard: Ratecard | undefined,
  projekt: Projekt | undefined,
  kundeName: string,
  stammdaten: Stammdaten,
) {
  const filename = `KVA-${(kva.bezeichnung || 'unbenannt').replace(/[^\w-]+/g, '_')}.pdf`
  await downloadPdf(await buildKvaPdf(kva, ratecard, projekt, kundeName, stammdaten), filename)
}
