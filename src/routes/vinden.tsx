import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { listFinderProducts, publicCategories } from '../public/catalog'
import { ProductCard } from '../public/components'
import { categoryPath } from '../public/pages'

const finderSearch = z.object({
  categorie: z.string().catch(''),
  maat: z
    .union([z.string(), z.number().transform((value) => String(value))])
    .catch(''),
})

export const Route = createFileRoute('/vinden')({
  validateSearch: finderSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => deps,
  head: () => ({
    meta: [
      { title: 'Finder — Babyboel' },
      { name: 'robots', content: 'noindex, follow' },
    ],
    links: [{ rel: 'canonical', href: 'https://babyboel.nl/' }],
  }),
  component: FinderResults,
})

function FinderResults() {
  const search = Route.useLoaderData()
  const category = publicCategories.find(
    (candidate) => candidate.slug === search.categorie,
  )
  if (!category) return <InvalidFinderSelection />

  const selectedSize = search.maat || undefined
  const invalidWipesSize =
    category.code === 'wipes' && selectedSize !== undefined
  const invalidCategorySize =
    selectedSize && !category.sizes.includes(selectedSize as never)

  if (invalidWipesSize || invalidCategorySize) {
    return <InvalidFinderSelection />
  }

  if (category.sizes.length > 0 && !selectedSize) {
    return (
      <main className="page" id="main" tabIndex={-1}>
        <p className="eyebrow">Stap 2</p>
        <h1>Kies een maat voor {category.name.toLowerCase()}</h1>
        <ul className="size-list">
          {category.sizes.map((size) => (
            <li key={size}>
              <a
                className="surface"
                href={`/vinden?categorie=${category.slug}&maat=${encodeURIComponent(size)}`}
              >
                Maat {size}
              </a>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  const products = listFinderProducts(category.slug, selectedSize)
  return (
    <main className="page" id="main" tabIndex={-1}>
      <p className="eyebrow">Optionele verfijning</p>
      <h1>
        Kies een exact Product of bekijk alle {category.name.toLowerCase()}
      </h1>
      <p className="lede">
        Products in deze selectie zijn alternatieven, niet onderling
        gelijkwaardig.
      </p>
      <p>
        <a
          className="button"
          href={categoryPath(category, selectedSize ?? null)}
        >
          Bekijk de volledige vergelijking
        </a>
      </p>
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </main>
  )
}

function InvalidFinderSelection() {
  return (
    <main className="page" id="main" tabIndex={-1}>
      <p className="eyebrow">Selectie niet herkend</p>
      <h1>Deze categorie en maat passen niet bij elkaar</h1>
      <p className="lede">
        We verbreden of herschrijven je selectie niet. Kies opnieuw uit de
        beschikbare cataloguswaarden.
      </p>
      <a className="button" href="/#finder">
        Terug naar de finder
      </a>
    </main>
  )
}
