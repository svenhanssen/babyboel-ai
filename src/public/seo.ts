import {
  getPublicProduct,
  listPublicProducts,
  publicCategories,
  publicFixtureNow,
  publicProductRouteKeys,
} from './catalog'
import { categoryPath } from './pages'
import { publicSiteOrigin } from './trust-identity'
import { trustPageLinks } from './trust-page'

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
