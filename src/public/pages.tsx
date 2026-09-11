import {
  listPublicProducts,
  publicFixtureNow,
  type PublicCategory,
} from './catalog'
import { ProductCard } from './components'

export function normalizedSizeFromRoute(value: string) {
  const routeValue = value.replace(/^maat-/, '')
  return routeValue.endsWith('-plus')
    ? `${routeValue.slice(0, -5)}+`
    : routeValue
}

export function normalizedSizeToRoute(value: string) {
  return value.replace('+', '-plus')
}

export function categoryPath(category: PublicCategory, size?: string | null) {
  return size
    ? `/${category.slug}/maat-${normalizedSizeToRoute(size)}`
    : `/${category.slug}`
}

export function resolveSizeBrowse(
  category: PublicCategory,
  routeSize: string,
  page: number,
) {
  const size = normalizedSizeFromRoute(routeSize)
  if (!category.sizes.some((candidate) => candidate === size)) return null
  const firstPage = listPublicProducts({
    category: category.slug,
    size,
    page: 1,
    now: publicFixtureNow,
  })
  return page <= firstPage.pageCount ? size : null
}

export function sizeBrowseHead(category: PublicCategory, size = '', page = 1) {
  const pageSuffix = page > 1 ? `?page=${page}` : ''
  return {
    meta: [
      {
        title: `${category.name} maat ${size} vergelijken — Babyboel`,
      },
      {
        name: 'description',
        content: `Vergelijk actuele Offers voor ${category.name.toLowerCase()} maat ${size}.`,
      },
    ],
    links: [
      {
        rel: 'canonical',
        href: `https://babyboel.nl${categoryPath(category, size)}${pageSuffix}`,
      },
    ],
  }
}

export function CategoryLanding({ category }: { category: PublicCategory }) {
  return (
    <main className="page" id="main" tabIndex={-1}>
      <nav aria-label="Kruimelpad">
        <ol className="breadcrumbs">
          <li>
            <a href="/">Home</a>
          </li>
          <li aria-current="page">{category.name}</li>
        </ol>
      </nav>
      <header className="browse-heading">
        <p className="eyebrow">Kies een genormaliseerde maat</p>
        <h1>{category.name} vergelijken</h1>
        <p className="lede">
          Iedere maat is een exacte catalogusmaat. Een plusmaat blijft
          afzonderlijk van de basismaat.
        </p>
      </header>
      <ul className="size-list">
        {category.sizes.map((size) => (
          <li key={size}>
            <a className="surface" href={categoryPath(category, size)}>
              <strong>Maat {size}</strong>
              <span>Bekijk Products en actuele Offers</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}

export function BrowsePage({
  category,
  size,
  page,
}: {
  category: PublicCategory
  size?: string
  page: number
}) {
  const result = listPublicProducts({
    category: category.slug,
    size,
    page,
    now: publicFixtureNow,
  })
  const currentProducts = result.products.filter(({ bestOffer }) => bestOffer)
  const unavailableProducts = result.products.filter(
    ({ bestOffer }) => !bestOffer,
  )
  const cleanPath = categoryPath(category, size)

  return (
    <main className="page" id="main" tabIndex={-1}>
      <nav aria-label="Kruimelpad">
        <ol className="breadcrumbs">
          <li>
            <a href="/">Home</a>
          </li>
          {size ? (
            <>
              <li>
                <a href={categoryPath(category)}>{category.name}</a>
              </li>
              <li aria-current="page">Maat {size}</li>
            </>
          ) : (
            <li aria-current="page">{category.name}</li>
          )}
        </ol>
      </nav>
      <header className="browse-heading">
        <p className="eyebrow">
          {result.total} {result.total === 1 ? 'Product' : 'Products'}
        </p>
        <h1>
          {category.name}
          {size ? ` maat ${size}` : ''} vergelijken
          {page > 1 ? ` — pagina ${page}` : ''}
        </h1>
        <p className="lede">
          Gerangschikt op de laagste actuele universele stukprijs. Offers met
          voorwaarden bepalen deze volgorde niet.
        </p>
      </header>
      {result.total === 0 ? (
        <div className="surface empty-state">
          <h2>Geen Products binnen deze selectie</h2>
          <p>
            We verbreden de vergelijking niet stilzwijgend. Kies een andere maat
            of categorie.
          </p>
          <a href="/">Terug naar de finder</a>
        </div>
      ) : (
        <>
          <section aria-labelledby="current-products">
            <h2 id="current-products">Actueel vergelijkbaar</h2>
            <div className="product-grid">
              {currentProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
          {unavailableProducts.length > 0 && (
            <section
              aria-labelledby="unavailable-products"
              className="product-section"
            >
              <h2 id="unavailable-products">Geen actuele prijs</h2>
              <p>
                Deze Products blijven vindbaar, maar hebben nu geen bevestigde
                universele Offer.
              </p>
              <div className="product-grid">
                {unavailableProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
          {result.pageCount > 1 && (
            <nav aria-label="Paginering" className="pagination">
              {page > 1 ? (
                <a
                  href={
                    page === 2 ? cleanPath : `${cleanPath}?page=${page - 1}`
                  }
                  rel="prev"
                >
                  Vorige
                </a>
              ) : (
                <span />
              )}
              <span>
                Pagina {page} van {result.pageCount}
              </span>
              {page < result.pageCount && (
                <a href={`${cleanPath}?page=${page + 1}`} rel="next">
                  Volgende
                </a>
              )}
            </nav>
          )}
        </>
      )}
    </main>
  )
}
