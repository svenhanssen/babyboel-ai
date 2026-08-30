import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { z } from 'zod'

import {
  getReviewCase,
  listReviewCases,
  resolveReviewCase,
  searchCatalog,
} from '../catalog/admin'
import { uuidV7Schema } from '../db/validation'
import { authenticateAdminServerRequest } from '../security/admin-boundary'

const noStore = () => setResponseHeader('Cache-Control', 'private, no-store')

const reviewFilters = z.object({
  status: z.enum(['open', 'closed']).optional(),
  retailerId: uuidV7Schema.optional(),
  uncertaintyType: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

export const getReviewQueueFn = createServerFn({ method: 'GET' })
  .validator(reviewFilters)
  .handler(async ({ data }) => {
    await authenticateAdminServerRequest(getRequest(), env)
    noStore()
    return listReviewCases(env.DB, data)
  })

export const getReviewCaseFn = createServerFn({ method: 'GET', strict: false })
  .validator(z.object({ caseId: uuidV7Schema }))
  .handler(async ({ data }) => {
    await authenticateAdminServerRequest(getRequest(), env)
    noStore()
    return getReviewCase(env.DB, data)
  })

const resolveInput = z.object({
  caseId: uuidV7Schema,
  expectedCaseVersion: z.number().int().positive(),
  expectedListingUpdatedAt: z.number().int().nonnegative(),
  changedAt: z.number().int().nonnegative(),
  auditId: uuidV7Schema,
  action: z.enum([
    'associate',
    'out_of_scope',
    'mark_unavailable',
    'false_alarm',
    'ignore',
    'defer',
  ]),
  packageId: uuidV7Schema.optional(),
  reason: z.string().min(10).max(500),
})

export const resolveReviewCaseFn = createServerFn({ method: 'POST' })
  .validator(resolveInput)
  .handler(async ({ data }) => {
    const actor = await authenticateAdminServerRequest(getRequest(), env)
    noStore()
    return resolveReviewCase(env.DB, { ...data, actor })
  })

const catalogFilters = z.object({
  search: z.string().max(200).optional(),
  entityType: z.enum(['all', 'product', 'package', 'listing']).optional(),
  lifecycle: z.enum(['all', 'active', 'inactive']).optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

export const searchCatalogFn = createServerFn({ method: 'GET', strict: false })
  .validator(catalogFilters)
  .handler(async ({ data }) => {
    await authenticateAdminServerRequest(getRequest(), env)
    noStore()
    return searchCatalog(env.DB, data)
  })
