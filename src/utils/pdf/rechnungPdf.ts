import type { Content, TableCell } from 'pdfmake'
import type { Rechnung, Stammdaten } from '../../db/types'
import { projekteRepo, kundenRepo } from '../../db/repo'
import { formatEuro, formatDate } from '../format'
import { rechnungTotals } from '../rechnung'
import { downloadPdf } from './setup'
import { absenderBlock, cell, fetchLogoDataUrl, footerBlock, metaTable, pdfStyles } from './shared'

// Überschrift im Format "Rechnung – Nummer – Kunde – Tätigkeit". Kunde/
// Tätigkeit werden weggelassen, falls nicht ermittelbar bzw. nicht ausgefüllt,
// damit die Überschrift nie mit einem leeren " – " endet.
async function rechnungTitel(rechnung: Rechnung): Promise<string> {
  const projekt = await projekteRepo.get(rechnung.projektId)
  const kunde = projekt ? await kundenRepo.get(projekt.kundeId) : undefined
  const teile = [rechnung.rechnungsnummer, kunde?.name, rechnung.taetigkeit.trim()].filter(
    (t): t is string => !!t && t.trim().length > 0,
  )
  return `Rechnung – ${teile.join(' – ')}`
}

export async function buildRechnungPdf(rechnung: Rechnung, stammdaten: Stammdaten) {
  const { netto, ustBetrag, brutto } = rechnungTotals(rechnung.positionen, rechnung.ustSatz)
  const logoDataUrl = await fetchLogoDataUrl(stammdaten.logoUrl)
  const titel = await rechnungTitel(rechnung)

  const positionenRows: TableCell[][] = rechnung.positionen.map((p) => [
    cell(p.beschreibung, { style: 'cell' }),
    cell(String(p.menge), { style: 'cell', alignment: 'right' }),
    cell(p.einheit, { style: 'cell' }),
    cell(formatEuro(p.einzelpreis), { style: 'cell', alignment: 'right' }),
    cell(formatEuro(p.menge * p.einzelpreis), { style: 'cell', alignment: 'right' }),
  ])

  // Einheitlicher Abstand vor jedem neuen Textblock, damit die Rechnung
  // durchgehend gleichmäßig wirkt statt mit unterschiedlich großen Lücken.
  const GAP: [number, number, number, number] = [0, 16, 0, 0]

  const content: Content[] = [
    absenderBlock(stammdaten, logoDataUrl, true),
    // Empfängeradresse: früher stand hier zusätzlich eine verkleinerte
    // Absenderzeile plus das Label "Rechnungsanschrift" darüber — wirkte
    // wie eine doppelte Adresse, da der Absender ja bereits vollständig
    // oben steht. Jetzt nur noch die reine Anschrift, ohne Beschriftung,
    // und in der gleichen Größe wie der Absenderblock.
    { text: rechnung.rechnungsanschrift, style: 'cell', margin: GAP },
    {
      text: `${titel} · vom ${formatDate(rechnung.erstelltAm.slice(0, 10))}`,
      style: 'docTitleCompact',
      margin: GAP,
    },
    // Fälligkeitsdatum, Bestellnummer und Leistungszeitraum stehen bewusst
    // in einer einzigen Liste untereinander statt in zwei Spalten nebeneinander.
    {
      margin: GAP,
      stack: [
        metaTable([
          ['Fälligkeitsdatum', formatDate(rechnung.faelligkeitsdatum)],
          ...(rechnung.bestellnummer.trim() ? ([['Bestellnummer', rechnung.bestellnummer]] as [string, string][]) : []),
          ['Leistungszeitraum von', formatDate(rechnung.leistungszeitraumVon)],
          ['Leistungszeitraum bis', formatDate(rechnung.leistungszeitraumBis)],
        ]),
      ],
    },
    {
      margin: GAP,
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
      margin: GAP,
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
      margin: GAP,
      stack: [{ text: 'Lieferanschrift', style: 'label' }, { text: rechnung.lieferanschrift, style: 'cell' }],
    })
  }

  if (stammdaten.rechnungAbschlusstext.trim()) {
    content.push({ text: stammdaten.rechnungAbschlusstext, style: 'small', margin: GAP })
  }

  if (stammdaten.zahlungsbedingungen.trim()) {
    content.push({ text: stammdaten.zahlungsbedingungen, style: 'small', margin: GAP })
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
