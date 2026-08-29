export const categoryCodes = [
  'disposable_diaper',
  'diaper_pants',
  'wipes',
] as const

export type CategoryCode = (typeof categoryCodes)[number]

export const normalizedSizeCodes = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '4+',
  '5',
  '5+',
  '6',
  '7',
  '8',
] as const

export type NormalizedSizeCode = (typeof normalizedSizeCodes)[number]

export const currentOfferFreshnessMilliseconds = 48 * 60 * 60 * 1000
