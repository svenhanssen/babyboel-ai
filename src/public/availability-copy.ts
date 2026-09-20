import {
  productName,
  publicAvailabilityLabel,
  type PublicAvailabilityState,
} from './catalog'

const availabilityCopy: Record<
  PublicAvailabilityState,
  {
    lede: string
    description: (name: string) => string
  }
> = {
  current: {
    lede: 'Vergelijk actuele Offers voor precies dit Product.',
    description: (name) =>
      `Vergelijk actuele universele en beperkte Offers voor ${name}.`,
  },
  no_current_offer: {
    lede: `${publicAvailabilityLabel.no_current_offer} binnen 48 uur. Historie blijft zichtbaar.`,
    description: (name) =>
      `${publicAvailabilityLabel.no_current_offer} voor ${name} binnen 48 uur. Historie blijft zichtbaar.`,
  },
  degraded: {
    lede: `${publicAvailabilityLabel.degraded}. Identiteit en historie blijven zichtbaar.`,
    description: (name) =>
      `${publicAvailabilityLabel.degraded} voor ${name}. Identiteit en historie blijven zichtbaar.`,
  },
  unavailable: {
    lede: `${publicAvailabilityLabel.unavailable} volgens de retailer. Historie blijft zichtbaar.`,
    description: (name) =>
      `${name} is volgens de retailer ${publicAvailabilityLabel.unavailable.toLowerCase()}. Historie blijft zichtbaar.`,
  },
}

export function cardAvailabilityLabel(state: PublicAvailabilityState) {
  return state === 'current'
    ? publicAvailabilityLabel.no_current_offer
    : publicAvailabilityLabel[state]
}

export function publicAvailabilityLede(state: PublicAvailabilityState) {
  return availabilityCopy[state].lede
}

export function publicAvailabilityDescription(product: {
  brand: string
  line: string
  variant: string
  normalizedSize: string | null
  availabilityState: PublicAvailabilityState
}) {
  return availabilityCopy[product.availabilityState].description(
    productName(product),
  )
}
