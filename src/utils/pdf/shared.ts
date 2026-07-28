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

export function absenderBlock(stammdaten: Stammdaten, logoDataUrl?: string): Content {
  const stack: Content[] = []
  if (logoDataUrl) {
    stack.push({ image: logoDataUrl, width: 120, margin: [0, 0, 0, 8] })
  }
  stack.push(
    { text: stammdaten.name || 'Absender', style: 'brand' },
    { text: stammdaten.adresse || '', style: 'small' },
    { text: [stammdaten.telefon, stammdaten.email].filter(Boolean).join(' · '), style: 'small' },
    { text: stammdaten.website || '', style: 'small' },
  )
  return { stack }
}

// pdfmake kann Bilder nur als Base64-Data-URI einbetten, nicht per direkter
// Remote-URL. Das hochgeladene Logo liegt aber als öffentliche Supabase-
// Storage-URL vor — wird hier client-seitig geladen und umgewandelt. Schlägt
// das fehl (z.B. kein Logo hinterlegt, Netzwerkfehler), wird `undefined`
// zurückgegeben und der Aufrufer lässt den Logo-Platz einfach weg.
export async function fetchLogoDataUrl(url: string): Promise<string | undefined> {
  if (!url.trim()) return undefined
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
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
