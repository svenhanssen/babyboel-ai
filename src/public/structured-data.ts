import {
  categoryBrowsePath,
  productName,
  publicCategoryBySlug,
  type PublicProduct,
} from './catalog'
import { publicAvailabilityDescription } from './availability-copy'
import { publicSiteName, publicSiteOrigin } from './trust-identity'

const formatEuro = (amountMinor: number) => (amountMinor / 100).toFixed(2)

export function homeStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'WebSite'],
    name: publicSiteName,
    url: `${publicSiteOrigin}/`,
  }
}

export function productStructuredData(product: PublicProduct) {
  const name = productName(product)
  const categoryPathValue = categoryBrowsePath(
    product.category,
    product.normalizedSize,
  )
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${publicSiteOrigin}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: publicCategoryBySlug[product.category].name,
        item: `${publicSiteOrigin}${categoryPathValue}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name,
        item: `${publicSiteOrigin}/producten/${product.routeKey}`,
      },
    ],
  }
  const productNode: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: { '@type': 'Brand', name: product.brand },
  }
  if (product.offers.primary.length > 0) {
    const totals = product.offers.primary.map(
      (offer) => offer.payableAmountMinor,
    )
    productNode.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: formatEuro(Math.min(...totals)),
      highPrice: formatEuro(Math.max(...totals)),
      offerCount: String(product.offers.primary.length),
    }
  }
  return [breadcrumb, productNode]
}

export function productPageHead(product: PublicProduct) {
  const name = productName(product)
  const canonical = `${publicSiteOrigin}/producten/${product.routeKey}`
  const description = publicAvailabilityDescription(product)
  return {
    meta: [
      { title: `${name} vergelijken — Babyboel` },
      { name: 'description', content: description },
      { property: 'og:title', content: `${name} vergelijken` },
      { property: 'og:description', content: description },
      { property: 'og:url', content: canonical },
      { property: 'og:locale', content: 'nl_NL' },
    ],
    links: [{ rel: 'canonical', href: canonical }],
  }
}
