import type { Alignment, Content, Style, TableCell } from 'pdfmake'
import type { Stammdaten } from '../../db/types'
import { formatDate } from '../format'

export function cell(text: string, opts?: { style?: string; alignment?: Alignment }): TableCell {
  return { text, style: opts?.style, alignment: opts?.alignment }
}

export const pdfStyles: Record<string, Style> = {
  brand: { fontSize: 16, bold: true },
  docTitle: { fontSize: 20, bold: true, margin: [0, 24, 0, 12] },
  label: { fontSize: 8, color: '#666666' },
  small: { fontSize: 8, color: '#666666' },
  tableHeader: { bold: true, fontSize: 9, fillColor: '#eeeeee' },
  cell: { fontSize: 9 },
  totalLabel: { fontSize: 10, bold: true },
  sectionTitle: { fontSize: 12, bold: true, margin: [0, 16, 0, 6] },
}

export function absenderBlock(stammdaten: Stammdaten): Content {
  return {
    stack: [
      { text: stammdaten.name || 'Absender', style: 'brand' },
      { text: stammdaten.adresse || '', style: 'small' },
      { text: [stammdaten.telefon, stammdaten.email].filter(Boolean).join(' · '), style: 'small' },
      { text: stammdaten.website || '', style: 'small' },
    ],
  }
}

export function absenderZeile(stammdaten: Stammdaten): string {
  return [stammdaten.name, stammdaten.adresse.replace(/\n/g, ', ')].filter(Boolean).join(' · ')
}

export function footerBlock(stammdaten: Stammdaten): Content {
  return {
    margin: [40, 8, 40, 0],
    fontSize: 8,
    color: '#666666',
    columns: [
      {
        width: '*',
        text: [stammdaten.name, stammdaten.steuernummer ? `USt-IdNr./Steuernr.: ${stammdaten.steuernummer}` : '']
          .filter(Boolean)
          .join(' · '),
      },
      {
        width: '*',
        text: [
          stammdaten.bank && `${stammdaten.bank}`,
          stammdaten.iban && `IBAN: ${stammdaten.iban}`,
          stammdaten.bic && `BIC: ${stammdaten.bic}`,
        ]
          .filter(Boolean)
          .join(' · '),
        alignment: 'right',
      },
    ],
  }
}

export function metaTable(rows: [string, string][]): Content {
  return {
    table: {
      widths: ['auto', 'auto'],
      body: rows.map(([label, value]) => [
        { text: label, style: 'label', border: [false, false, false, false] },
        { text: value, style: 'cell', border: [false, false, false, false] },
      ]),
    },
    layout: 'noBorders',
  }
}

export function formatDateOrDash(value?: string): string {
  return value ? formatDate(value) : '–'
}
