import { createFileRoute, notFound } from '@tanstack/react-router'

import { getPublicProduct, publicFixtureNow } from '../public/catalog'
import { ProductPageContent } from '../public/components'
import {
  productPageHead,
  productStructuredData,
} from '../public/structured-data'

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
  head: ({ loaderData }) => (loaderData ? productPageHead(loaderData) : {}),
  component: ProductPage,
})

function ProductPage() {
  const product = Route.useLoaderData()
  return (
    <main className="page product-page" id="main" tabIndex={-1}>
      {productStructuredData(product).map((data) => (
        <script
          key={String(data['@type'])}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
      <ProductPageContent product={product} />
    </main>
  )
}
