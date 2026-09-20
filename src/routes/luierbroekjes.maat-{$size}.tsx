import {
  createFileRoute,
  notFound,
  stripSearchParams,
} from '@tanstack/react-router'
import { z } from 'zod'

import { publicCategoryBySlug } from '../public/catalog'
import {
  BrowsePage,
  resolveSizeBrowse,
  sizeBrowseHead,
  throwIfCanonicalPageOne,
} from '../public/pages'

const category = publicCategoryBySlug.luierbroekjes
const searchSchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
})

export const Route = createFileRoute('/luierbroekjes/maat-{$size}')({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  loaderDeps: ({ search }) => search,
  beforeLoad: ({ location }) => throwIfCanonicalPageOne(location),
  loader: ({ deps, params }) => {
    const size = resolveSizeBrowse(category, params.size, deps.page)
    if (!size) {
      // TanStack Router uses its own serializable not-found control value.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw notFound()
    }
    return { size, page: deps.page }
  },
  head: ({ loaderData }) =>
    sizeBrowseHead(category, loaderData?.size, loaderData?.page),
  component: PantsBySize,
})

function PantsBySize() {
  const { size } = Route.useLoaderData()
  const { page } = Route.useSearch()
  return <BrowsePage category={category} page={page} size={size} />
}
