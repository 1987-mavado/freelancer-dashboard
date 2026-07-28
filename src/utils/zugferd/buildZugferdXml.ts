import type { Rechnung, Stammdaten } from '../../db/types'
import { rechnungTotals } from '../rechnung'
import { escXml as esc, xmlAmount as amount } from '../xml'
import { unitCodeFor } from '../xrechnung/unitCodes'

function cciDate(isoDate: string): string {
  return isoDate.slice(0, 10).replace(/-/g, '')
}

export function buildZugferdXml(rechnung: Rechnung, stammdaten: Stammdaten): string {
  const { netto, ustBetrag, brutto } = rechnungTotals(rechnung.positionen, rechnung.ustSatz)
  const isExempt = rechnung.ustSatz === 0
  const categoryCode = isExempt ? 'E' : 'S'
  const exemptionReason = isExempt
    ? '\n            <ram:ExemptionReason>Gemäß §19 UStG wird keine Umsatzsteuer berechnet.</ram:ExemptionReason>'
    : ''

  const supplierTaxRegistration = stammdaten.ustIdNr.trim()
    ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(stammdaten.ustIdNr.trim())}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
    : stammdaten.steuernummer.trim()
      ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="FC">${esc(stammdaten.steuernummer.trim())}</ram:ID>
        </ram:SpecifiedTaxRegistration>`
      : ''

  const buyerReference = rechnung.leitwegId.trim() || rechnung.empfaengerName.trim() || rechnung.rechnungsnummer

  const lines = rechnung.positionen
    .map((p, i) => {
      const lineTotal = p.menge * p.einzelpreis
      const unitCode = unitCodeFor(p.einheit)
      return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(p.beschreibung)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${amount(p.einzelpreis)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${unitCode}">${amount(p.menge)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${categoryCode}</ram:CategoryCode>
          <ram:RateApplicablePercent>${amount(rechnung.ustSatz)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${amount(lineTotal)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(rechnung.rechnungsnummer)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${cciDate(rechnung.erstelltAm)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lines}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${esc(buyerReference)}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${esc(stammdaten.name)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(stammdaten.plz)}</ram:PostcodeCode>
          <ram:LineOne>${esc(stammdaten.strasse)}</ram:LineOne>
          <ram:CityName>${esc(stammdaten.ort)}</ram:CityName>
          <ram:CountryID>${esc(stammdaten.land || 'DE')}</ram:CountryID>
        </ram:PostalTradeAddress>${supplierTaxRegistration}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${esc(rechnung.empfaengerName)}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${esc(rechnung.empfaengerPlz)}</ram:PostcodeCode>
          <ram:LineOne>${esc(rechnung.empfaengerStrasse)}</ram:LineOne>
          <ram:CityName>${esc(rechnung.empfaengerOrt)}</ram:CityName>
          <ram:CountryID>${esc(rechnung.empfaengerLand || 'DE')}</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${cciDate(rechnung.leistungszeitraumBis)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(stammdaten.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amount(ustBetrag)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${amount(netto)}</ram:BasisAmount>
        <ram:CategoryCode>${categoryCode}</ram:CategoryCode>${exemptionReason}
        <ram:RateApplicablePercent>${amount(rechnung.ustSatz)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${esc(stammdaten.zahlungsbedingungen)}</ram:Description>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${cciDate(rechnung.faelligkeitsdatum)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amount(netto)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amount(netto)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${amount(ustBetrag)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amount(brutto)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amount(brutto)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`
}
