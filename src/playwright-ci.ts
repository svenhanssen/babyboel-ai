const lockfileVersionPattern =
  /'@playwright\/test':\n\s+specifier: .+\n\s+version: (\S+)/

function playwrightVersionFromLockfile(lockfile: string): string {
  const match = lockfile.match(lockfileVersionPattern)
  if (!match) {
    throw new Error('Could not resolve @playwright/test from the lockfile')
  }

  return match[1]
}

export function validatePlaywrightDelivery({
  lockfile,
  workflow,
}: {
  lockfile: string
  workflow: string
}): void {
  const version = playwrightVersionFromLockfile(lockfile)
  const image = `mcr.microsoft.com/playwright:v${version}-noble`

  if (!workflow.includes(`image: ${image}`)) {
    throw new Error(`Delivery workflow must use ${image}`)
  }

  if (workflow.includes('playwright install')) {
    throw new Error(
      'Delivery workflow must not install Playwright browsers or system dependencies',
    )
  }

  if (!workflow.includes('pnpm test:browser')) {
    throw new Error('Delivery workflow must run browser tests')
  }

  if (!workflow.includes('needs: [quality, browser]')) {
    throw new Error(
      'Preview and production jobs must wait for quality and browser tests',
    )
  }
}

export function validateLocalCheckScripts(
  scripts: Record<string, string>,
): void {
  const quality = scripts['check:quality']
  const check = scripts.check

  if (!quality) {
    throw new Error('Local check:quality script is missing')
  }

  if (quality.includes('test:browser')) {
    throw new Error('check:quality must not run browser tests')
  }

  if (!check?.includes('check:quality') || !check.includes('test:browser')) {
    throw new Error(
      'Local pnpm check must run check:quality and then browser tests',
    )
  }
}
