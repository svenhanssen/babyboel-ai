export function adminServerFnHeaders(
  method: 'GET' | 'POST',
): HeadersInit | undefined {
  if (typeof document === 'undefined') return undefined

  const headers = new Headers()
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    headers.set('X-Babyboel-Local-Actor', 'local-operator')
  }
  if (method === 'POST') {
    const csrf = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find(
        (part) =>
          part.startsWith('babyboel-csrf=') ||
          part.startsWith('__Host-babyboel-csrf='),
      )
      ?.split('=', 2)[1]
    if (csrf) headers.set('X-Babyboel-CSRF', csrf)
  }
  return headers
}
