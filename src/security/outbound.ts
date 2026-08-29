const parseSafeHttpsDestination = (value: string) => {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('OUTBOUND_DESTINATION_REJECTED')
  }
  return url.href
}

export function requireVerifiedOutboundDestination(
  requestedDestination: string,
  verifiedListingDestination: string,
): string {
  try {
    const requested = parseSafeHttpsDestination(requestedDestination)
    const verified = parseSafeHttpsDestination(verifiedListingDestination)
    if (requested !== verified) {
      throw new Error('OUTBOUND_DESTINATION_REJECTED')
    }
    return verified
  } catch {
    throw new Error('OUTBOUND_DESTINATION_REJECTED')
  }
}
