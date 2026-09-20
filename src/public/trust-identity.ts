export const publicSiteOrigin = 'https://babyboel.nl'
export const publicSiteName = 'Babyboel'
export const publicContactEmail = 'contact@babyboel.nl'
export const publicTrustUpdatedOn = '20 september 2026'

export type PublicCoverageStatus =
  'actief' | 'tijdelijk gepauzeerd' | 'nog niet actief'

export const publicRetailerCoverage: Array<{
  name: string
  status: PublicCoverageStatus
  detail: string
}> = [
  {
    name: 'Wehkamp',
    status: 'actief',
    detail: 'Laatste succesvolle controle: 11 september 2026, 12:00 uur.',
  },
  {
    name: 'Plein',
    status: 'actief',
    detail: 'Laatste succesvolle controle: 11 september 2026, 12:00 uur.',
  },
  {
    name: 'bol.com',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
  {
    name: 'Babydrogist',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
  {
    name: 'OnlineLuiers',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
  {
    name: 'Etos',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
  {
    name: 'Albert Heijn',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
  {
    name: 'Trekpleister',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
  {
    name: 'Kruidvat',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
  {
    name: 'Jumbo',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
  {
    name: 'Blokker',
    status: 'nog niet actief',
    detail: 'Nog niet opgenomen in deze vergelijking.',
  },
]
