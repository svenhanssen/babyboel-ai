import { createFileRoute, notFound } from '@tanstack/react-router'

import { getPublicProduct, publicFixtureNow } from '../public/catalog'
import { productName, ProductPageContent } from '../public/components'

export const Route = createFileRoute('/producten/$productKey')({
  loader: ({ params }) => {
    const product = getPublicProduct(params.productKey, publicFixtureNow)
    if (!product) {
      // TanStack Router uses its own serializable not-found control value.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw notFound()
    }
    return product
  },
  head: ({ loaderData }) => {
    const name = loaderData ? productName(loaderData) : 'Product'
    return {
      meta: [
        { title: `${name} vergelijken — Babyboel` },
        {
          name: 'description',
          content: `Vergelijk actuele universele en beperkte Offers voor ${name}.`,
        },
        { property: 'og:title', content: `${name} vergelijken` },
        {
          property: 'og:description',
          content: `Controleer prijzen, voorwaarden en waargenomen prijsontwikkeling voor ${name}.`,
        },
      ],
      links: [
        {
          rel: 'canonical',
          href: `https://babyboel.nl/producten/${loaderData?.routeKey ?? ''}`,
        },
      ],
    }
  },
  component: ProductPage,
})

function ProductPage() {
  const product = Route.useLoaderData()
  return (
    <main className="page product-page" id="main" tabIndex={-1}>
      <ProductPageContent product={product} />
    </main>
  )
}
