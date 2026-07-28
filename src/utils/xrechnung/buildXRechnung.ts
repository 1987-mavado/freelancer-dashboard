import type { Rechnung, Stammdaten } from '../../db/types'
import { rechnungTotals } from '../rechnung'
import { escXml as esc, xmlAmount as amount } from '../xml'
import { unitCodeFor } from './unitCodes'

export function buildXRechnungXml(rechnung: Rechnung, stammdaten: Stammdaten): string {
  const { netto, ustBetrag, brutto } = rechnungTotals(rechnung.positionen, rechnung.ustSatz)
  const issueDate = rechnung.erstelltAm.slice(0, 10)
  const isExempt = rechnung.ustSatz === 0
  const taxCategoryId = isExempt ? 'E' : 'S'

  const supplierTaxScheme = stammdaten.ustIdNr.trim()
    ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(stammdaten.ustIdNr.trim())}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
    : stammdaten.steuernummer.trim()
      ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(stammdaten.steuernummer.trim())}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
      : ''

  const taxExemptionReason = isExempt
    ? '\n        <cbc:TaxExemptionReasonCode>VATEX-EU-79-C</cbc:TaxExemptionReasonCode>\n        <cbc:TaxExemptionReason>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</cbc:TaxExemptionReason>'
    : ''

  const buyerReference = rechnung.leitwegId.trim() || rechnung.empfaengerName.trim() || rechnung.rechnungsnummer

  const invoiceLines = rechnung.positionen
    .map((p, i) => {
      const lineTotal = p.menge * p.einzelpreis
      const unitCode = unitCodeFor(p.einheit)
      return `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${unitCode}">${amount(p.menge)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${amount(lineTotal)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${esc(p.beschreibung)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${taxCategoryId}</cbc:ID>
        <cbc:Percent>${amount(rechnung.ustSatz)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${amount(p.einzelpreis)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${esc(rechnung.rechnungsnummer)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${rechnung.faelligkeitsdatum}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${esc(buyerReference)}</cbc:BuyerReference>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(stammdaten.strasse)}</cbc:StreetName>
        <cbc:CityName>${esc(stammdaten.ort)}</cbc:CityName>
        <cbc:PostalZone>${esc(stammdaten.plz)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${esc(stammdaten.land || 'DE')}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>${supplierTaxScheme}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(stammdaten.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Name>${esc(stammdaten.name)}</cbc:Name>
        <cbc:Telephone>${esc(stammdaten.telefon)}</cbc:Telephone>
        <cbc:ElectronicMail>${esc(stammdaten.email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(rechnung.empfaengerStrasse)}</cbc:StreetName>
        <cbc:CityName>${esc(rechnung.empfaengerOrt)}</cbc:CityName>
        <cbc:PostalZone>${esc(rechnung.empfaengerPlz)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>${esc(rechnung.empfaengerLand || 'DE')}</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(rechnung.empfaengerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${esc(stammdaten.iban)}</cbc:ID>
      <cac:FinancialInstitutionBranch>
        <cbc:ID>${esc(stammdaten.bic)}</cbc:ID>
      </cac:FinancialInstitutionBranch>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:PaymentTerms>
    <cbc:Note>${esc(stammdaten.zahlungsbedingungen)}</cbc:Note>
  </cac:PaymentTerms>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${amount(ustBetrag)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${amount(netto)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${amount(ustBetrag)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${taxCategoryId}</cbc:ID>
        <cbc:Percent>${amount(rechnung.ustSatz)}</cbc:Percent>${taxExemptionReason}
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${amount(netto)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${amount(netto)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${amount(brutto)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${amount(brutto)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${invoiceLines}
</Invoice>
`
}

export async function exportXRechnung(rechnung: Rechnung, stammdaten: Stammdaten) {
  const xml = buildXRechnungXml(rechnung, stammdaten)
  const blob = new Blob([xml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${rechnung.rechnungsnummer}-xrechnung.xml`
  a.click()
  URL.revokeObjectURL(url)
}
