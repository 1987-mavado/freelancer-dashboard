// Client-seitige Beleg-Erkennung (Tesseract.js, läuft komplett im Browser,
// kein externer API-Key nötig). Die Extraktion von Aussteller/Adresse/Betrag
// aus dem erkannten Fließtext ist bewusst heuristisch (einfache Regeln statt
// KI-Verständnis) — Qualität ist entsprechend begrenzt, alle Felder bleiben
// im Formular normal editierbar.
export interface ErkannterBeleg {
  aussteller?: string
  adresse?: string
  betrag?: number
}

const PLZ_ZEILE = /\b\d{5}\s+\S+/

// Größter erkannter Geldbetrag im Text gilt als vermutliche Gesamtsumme
// (typischerweise die letzte/größte Zahl auf einer Quittung).
function groessterBetrag(text: string): number | undefined {
  const treffer = text.matchAll(/(\d{1,4}[.,]\d{2})\s*(€|eur)?/gi)
  let max: number | undefined
  for (const m of treffer) {
    const wert = parseFloat(m[1].replace(',', '.'))
    if (!Number.isNaN(wert) && (max === undefined || wert > max)) max = wert
  }
  return max
}

export async function erkenneBeleg(file: File): Promise<ErkannterBeleg> {
  const { recognize } = await import('tesseract.js')
  const { data } = await recognize(file, 'deu')
  const zeilen = data.text
    .split('\n')
    .map((z) => z.trim())
    .filter(Boolean)

  const aussteller = zeilen[0]
  const adresseZeile = zeilen.find((z) => PLZ_ZEILE.test(z))
  const betrag = groessterBetrag(data.text)

  return {
    aussteller,
    adresse: adresseZeile,
    betrag,
  }
}
