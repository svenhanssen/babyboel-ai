import { ExternalLink } from 'lucide-react'

import { PriceHistory } from '../ui/price-history'
import type {
  PublicOfferView,
  PublicProduct,
  PublicProductSummary,
} from './catalog'
import { trustPageLinks } from './trust-page'

const decimalFormatter = new Intl.NumberFormat('nl-NL', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const dateTimeFormatter = new Intl.DateTimeFormat('nl-NL', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Amsterdam',
})

export function formatMoney(amountMinor: number) {
  return `€ ${decimalFormatter.format(amountMinor / 100)}`
}

export function formatUnitPrice(offer: PublicOfferView) {
  return `${formatMoney(offer.payableAmountMinor / offer.totalUnits)} per stuk`
}

export function productName(product: {
  brand: string
  line: string
  variant: string
  normalizedSize: string | null
}) {
  return [
    product.brand,
    product.line,
    product.variant,
    product.normalizedSize ? `maat ${product.normalizedSize}` : null,
  ]
    .filter(Boolean)
    .join(' ')
}

function Freshness({ confirmedAt }: { confirmedAt: number }) {
  return (
    <span>
      Bevestigd{' '}
      <time dateTime={new Date(confirmedAt).toISOString()}>
        {dateTimeFormatter.format(confirmedAt)}
      </time>
    </span>
  )
}

export function ProductCard({ product }: { product: PublicProductSummary }) {
  const offer = product.bestOffer
  const name = productName(product)
  return (
    <article className="surface product-card">
      <div>
        <p className="eyebrow">
          {product.brand}
          {product.normalizedSize ? ` · maat ${product.normalizedSize}` : ''}
        </p>
        <h2>{product.line}</h2>
        <p>{product.variant}</p>
      </div>
      {offer ? (
        <div className="product-card__price">
          <strong>{formatUnitPrice(offer)}</strong>
          <span>{offer.retailerName}</span>
          {offer.requiredPackageCount > 1 && (
            <span>
              {offer.requiredPackageCount} verpakkingen · {offer.totalUnits}{' '}
              stuks · {formatMoney(offer.payableAmountMinor)} totaal
            </span>
          )}
          <Freshness confirmedAt={offer.confirmedAt} />
        </div>
      ) : (
        <p className="notice">Geen actuele prijs</p>
      )}
      <a
        className="button button--secondary"
        href={`/producten/${product.routeKey}`}
      >
        Bekijk {name}
      </a>
    </article>
  )
}

function OfferRow({
  offer,
  ranked,
}: {
  offer: PublicOfferView
  ranked: boolean
}) {
  return (
    <li className="offer-row">
      <div className="offer-row__heading">
        <div>
          <strong>{offer.retailerName}</strong>
          <span>
            {offer.packageUnitCount} stuks per verpakking
            {offer.requiredPackageCount > 1
              ? ` · ${offer.requiredPackageCount} verpakkingen`
              : ''}
          </span>
        </div>
        {ranked && <span className="tag">Actuele vergelijking</span>}
      </div>
      <div className="offer-row__facts">
        <strong>{formatUnitPrice(offer)}</strong>
        <span>
          {formatMoney(offer.payableAmountMinor)} voor {offer.totalUnits} stuks
        </span>
        {offer.conditionText && <span>{offer.conditionText}</span>}
        <Freshness confirmedAt={offer.confirmedAt} />
      </div>
      <details>
        <summary>Zo is de stukprijs berekend</summary>
        <p>
          {formatMoney(offer.payableAmountMinor)} ÷ {offer.totalUnits} stuks ={' '}
          {formatUnitPrice(offer)}. De prijs en voorwaarden zijn op het getoonde
          tijdstip bevestigd.
        </p>
      </details>
      <a className="button" href={offer.outboundDestination}>
        Bekijk bij {offer.retailerName}
        <ExternalLink aria-hidden="true" size={18} />
      </a>
    </li>
  )
}

export function OfferComparison({ product }: { product: PublicProduct }) {
  const { primary, restricted, bestWithoutMinimum } = product.offers
  if (primary.length === 0 && restricted.length === 0) return null

  return (
    <div className="offer-comparison">
      {primary.length > 0 && (
        <section aria-labelledby="universal-offers">
          <h2 id="universal-offers">Aanbiedingen voor iedereen</h2>
          {primary[0]?.requiredPackageCount > 1 && bestWithoutMinimum && (
            <p className="notice">
              De laagste stukprijs vraagt meerdere verpakkingen. Zonder
              minimumafname is {formatUnitPrice(bestWithoutMinimum)} bij{' '}
              {bestWithoutMinimum.retailerName}.
            </p>
          )}
          <ol className="offer-list">
            {primary.map((offer) => (
              <OfferRow key={offer.id} offer={offer} ranked />
            ))}
          </ol>
        </section>
      )}
      {restricted.length > 0 && (
        <section aria-labelledby="restricted-offers">
          <h2 id="restricted-offers">Aanbiedingen met voorwaarden</h2>
          <p>
            Deze prijzen vragen lidmaatschap, een coupon of een andere
            voorwaarde en tellen niet mee voor de rangschikking hierboven.
          </p>
          <ul className="offer-list">
            {restricted.map((offer) => (
              <OfferRow key={offer.id} offer={offer} ranked={false} />
            ))}
          </ul>
        </section>
      )}
      <p className="affiliate-note">
        Babyboel is niet de verkoper. Een retailerlink kan commissie opleveren
        zonder de rangschikking of prijs te veranderen.
      </p>
    </div>
  )
}

function AvailabilityNotice({ product }: { product: PublicProduct }) {
  if (product.availabilityState === 'current') return null
  if (product.availabilityState === 'degraded') {
    return (
      <div className="notice notice--warning" role="status">
        <strong>Vergelijking tijdelijk beperkt</strong>
        <span>
          We konden de actuele aanbiedingen van{' '}
          {product.degradedRetailers.join(', ')} tijdelijk niet volledig
          controleren. Daarom tonen we geen onbevestigde prijs of retaileractie.
        </span>
      </div>
    )
  }
  return (
    <div className="notice notice--warning" role="status">
      <strong>Geen actuele aanbieding</strong>
      <span>
        Er is binnen 48 uur geen beschikbare aanbieding bevestigd. Eerdere
        waarnemingen blijven hieronder zichtbaar, maar zijn geen actuele prijs.
      </span>
    </div>
  )
}

export function ProductPageContent({ product }: { product: PublicProduct }) {
  const name = productName(product)
  return (
    <>
      <nav aria-label="Kruimelpad">
        <ol className="breadcrumbs">
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a
              href={
                product.normalizedSize
                  ? `/${product.category}/maat-${product.normalizedSize.replace('+', '-plus')}`
                  : `/${product.category}`
              }
            >
              {product.category === 'luiers'
                ? 'Luiers'
                : product.category === 'luierbroekjes'
                  ? 'Luierbroekjes'
                  : 'Billendoekjes'}
            </a>
          </li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>
      <header className="product-heading">
        <p className="eyebrow">
          Exact Product
          {product.normalizedSize ? ` · maat ${product.normalizedSize}` : ''}
        </p>
        <h1>{name}</h1>
        <p className="lede">
          Vergelijk actuele aankoopmogelijkheden voor precies dit Product.
        </p>
      </header>
      <AvailabilityNotice product={product} />
      <OfferComparison product={product} />
      <section aria-labelledby="history-heading" className="product-section">
        <h2 id="history-heading">Waargenomen prijsontwikkeling</h2>
        <p>
          Laagste universele stukprijs per dag. Onderbrekingen betekenen dat er
          geen bruikbare waarneming was.
        </p>
        <PriceHistory points={product.history} />
      </section>
      <section
        aria-labelledby="alternatives-heading"
        className="product-section"
      >
        <h2 id="alternatives-heading">Andere Products in dezelfde maat</h2>
        <p>Dit zijn andere Products, geen gelijkwaardige verpakkingen.</p>
        <ul className="alternative-list">
          {product.alternatives.map((alternative) => (
            <li key={alternative.id}>
              <a href={`/producten/${alternative.routeKey}`}>
                {productName(alternative)}
              </a>
              {alternative.bestOffer ? (
                <span>{formatUnitPrice(alternative.bestOffer)}</span>
              ) : (
                <span>Geen actuele prijs</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <nav aria-label="Meer over deze vergelijking" className="context-links">
        {trustPageLinks.map((link) => (
          <a href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
    </>
  )
}
