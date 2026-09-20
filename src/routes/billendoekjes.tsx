import {
  createFileRoute,
  notFound,
  stripSearchParams,
} from '@tanstack/react-router'
import { z } from 'zod'

import {
  listPublicProducts,
  publicCategoryBySlug,
  publicFixtureNow,
} from '../public/catalog'
import { BrowsePage, throwIfCanonicalPageOne } from '../public/pages'
import { publicSiteOrigin } from '../public/trust-identity'

const category = publicCategoryBySlug.billendoekjes
const searchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
})

export const Route = createFileRoute('/billendoekjes')({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  loaderDeps: ({ search }) => search,
  beforeLoad: ({ location }) => throwIfCanonicalPageOne(location),
  loader: ({ deps }) => {
    const firstPage = listPublicProducts({
      category: category.slug,
      page: 1,
      now: publicFixtureNow,
    })
    if (deps.page > firstPage.pageCount) {
      // TanStack Router uses its own serializable not-found control value.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw notFound()
    }
    return deps
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `Billendoekjes vergelijken${loaderData && loaderData.page > 1 ? ` — pagina ${loaderData.page}` : ''} — Babyboel`,
      },
      {
        name: 'description',
        content: `Vergelijk actuele billendoekjes op universele stukprijs${loaderData && loaderData.page > 1 ? ` — pagina ${loaderData.page}` : ''}.`,
      },
    ],
    links: [
      {
        rel: 'canonical',
        href: `${publicSiteOrigin}/billendoekjes${loaderData && loaderData.page > 1 ? `?page=${loaderData.page}` : ''}`,
      },
    ],
  }),
  component: BillendoekjesPage,
})

function BillendoekjesPage() {
  const { page } = Route.useSearch()
  return <BrowsePage category={category} page={page} />
}
