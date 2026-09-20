import { runSyntheticAdapter } from './synthetic'

export const retailerAdapters = {
  'fixture-feed': runSyntheticAdapter,
} as const

export type RetailerSourceKey = keyof typeof retailerAdapters

export const adapterForSourceKey = (sourceKey: string | null) => {
  if (sourceKey === null) return undefined
  if (!(sourceKey in retailerAdapters)) return undefined
  return retailerAdapters[sourceKey as RetailerSourceKey]
}
