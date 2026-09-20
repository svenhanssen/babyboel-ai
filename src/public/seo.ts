import {
  getPublicProduct,
  listPublicProducts,
  productName,
  publicAvailabilityLabel,
  publicCategories,
  publicFixtureNow,
  publicProductRouteKeys,
  type PublicProduct,
} from './catalog'
import { categoryPath, normalizedSizeToRoute } from './pages'
import { publicSiteName, publicSiteOrigin } from './trust-identity'
import { trustPageLinks } from './trust-page'

export { publicSiteOrigin }

const formatEuro = (amountMinor: number) => (amountMinor / 100).toFixed(2)

export function listIndexablePublicPaths() {
  const paths = new Set<string>([
    '/',
    ...trustPageLinks.map(({ href }) => href),
  ])

  for (const category of publicCategories) {
    paths.add(categoryPath(category))
    if (category.sizes.length === 0) {
      const result = listPublicProducts({
        category: category.slug,
        page: 1,
        now: publicFixtureNow,
      })
      if (result.total === 0) paths.delete(categoryPath(category))
      continue
    }
    for (const size of category.sizes) {
      const result = listPublicProducts({
        category: category.slug,
        size,
        page: 1,
        now: publicFixtureNow,
      })
      if (result.total > 0) {
        paths.add(categoryPath(category, size))
      }
    }
  }

  for (const routeKey of publicProductRouteKeys()) {
    const product = getPublicProduct(routeKey, publicFixtureNow)
    if (product) paths.add(`/producten/${routeKey}`)
  }

  return [...paths]
}

export function robotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /vinden',
    `Sitemap: ${publicSiteOrigin}/sitemap.xml`,
    '',
  ].join('\n')
}

export function sitemapXml() {
  const urls = listIndexablePublicPaths()
    .map((path) => `  <url><loc>${publicSiteOrigin}${path}</loc></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function homeStructuredData() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'WebSite'],
    name: publicSiteName,
    url: `${publicSiteOrigin}/`,
  }
}

export function productStructuredData(product: PublicProduct) {
  const categoryPathValue = product.normalizedSize
    ? `/${product.category}/maat-${normalizedSizeToRoute(product.normalizedSize)}`
    : `/${product.category}`
  const name = productName(product)
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
        name:
          product.category === 'luiers'
            ? 'Luiers'
            : product.category === 'luierbroekjes'
              ? 'Luierbroekjes'
              : 'Billendoekjes',
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

function productDescription(product: PublicProduct) {
  const name = productName(product)
  if (product.availabilityState === 'current') {
    return `Vergelijk actuele universele en beperkte Offers voor ${name}.`
  }
  if (product.availabilityState === 'degraded') {
    return `${publicAvailabilityLabel.degraded} voor ${name}. Identiteit en historie blijven zichtbaar.`
  }
  if (product.availabilityState === 'unavailable') {
    return `${name} is volgens de retailer ${publicAvailabilityLabel.unavailable.toLowerCase()}. Historie blijft zichtbaar.`
  }
  return `${publicAvailabilityLabel.no_current_offer} voor ${name} binnen 48 uur. Historie blijft zichtbaar.`
}

export function productPageHead(product: PublicProduct) {
  const name = productName(product)
  const canonical = `${publicSiteOrigin}/producten/${product.routeKey}`
  return {
    meta: [
      { title: `${name} vergelijken — Babyboel` },
      { name: 'description', content: productDescription(product) },
      { property: 'og:title', content: `${name} vergelijken` },
      {
        property: 'og:description',
        content: productDescription(product),
      },
      { property: 'og:url', content: canonical },
      { property: 'og:locale', content: 'nl_NL' },
    ],
    links: [{ rel: 'canonical', href: canonical }],
  }
}

export function handleSitemap() {
  return new Response(sitemapXml(), {
    headers: {
      'cache-control': 'public, max-age=300',
      'content-type': 'application/xml; charset=utf-8',
    },
  })
}

export function handleRobots() {
  return new Response(robotsTxt(), {
    headers: {
      'cache-control': 'public, max-age=300',
      'content-type': 'text/plain; charset=utf-8',
    },
  })
}
