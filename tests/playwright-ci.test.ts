import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import {
  validateLocalCheckScripts,
  validatePlaywrightDelivery,
} from '../src/playwright-ci'

const matchingLockfile = `importers:
  .:
    devDependencies:
      '@playwright/test':
        specifier: ^1.63.0
        version: 1.63.0
`

const matchingWorkflow = `jobs:
  quality:
    name: Quality gates
    runs-on: ubuntu-latest
    steps:
      - run: pnpm check:quality
  browser:
    name: Browser tests
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.63.0-noble
    steps:
      - run: pnpm test:browser
  preview:
    needs: [quality, browser]
  production:
    needs: [quality, browser]
`

describe('Playwright delivery guards', () => {
  it('accepts a workflow whose Playwright image matches the lockfile', () => {
    expect(() =>
      validatePlaywrightDelivery({
        lockfile: matchingLockfile,
        workflow: matchingWorkflow,
      }),
    ).not.toThrow()
  })

  it('rejects a Playwright image that does not match the lockfile', () => {
    expect(() =>
      validatePlaywrightDelivery({
        lockfile: matchingLockfile,
        workflow: matchingWorkflow.replace('v1.63.0-noble', 'v1.62.0-noble'),
      }),
    ).toThrow(
      'Delivery workflow must use mcr.microsoft.com/playwright:v1.63.0-noble',
    )
  })

  it('rejects installing Playwright browsers in CI', () => {
    expect(() =>
      validatePlaywrightDelivery({
        lockfile: matchingLockfile,
        workflow: `${matchingWorkflow}\n      - run: pnpm exec playwright install --with-deps chromium\n`,
      }),
    ).toThrow(
      'Delivery workflow must not install Playwright browsers or system dependencies',
    )
  })

  it('requires deploy jobs to wait for browser tests', () => {
    expect(() =>
      validatePlaywrightDelivery({
        lockfile: matchingLockfile,
        workflow: matchingWorkflow.replaceAll(
          'needs: [quality, browser]',
          'needs: quality',
        ),
      }),
    ).toThrow(
      'Preview and production jobs must wait for quality and browser tests',
    )
  })

  it('keeps the checked-in delivery workflow aligned with the lockfile', async () => {
    const lockfile = await readFile(
      new URL('../pnpm-lock.yaml', import.meta.url),
      'utf8',
    )
    const workflow = await readFile(
      new URL('../.github/workflows/delivery.yml', import.meta.url),
      'utf8',
    )

    expect(() =>
      validatePlaywrightDelivery({ lockfile, workflow }),
    ).not.toThrow()
  })

  it('keeps local pnpm check including browser tests', async () => {
    const packageSource = await readFile(
      new URL('../package.json', import.meta.url),
      'utf8',
    )

    expect(() =>
      validateLocalCheckScripts(
        (JSON.parse(packageSource) as { scripts: Record<string, string> })
          .scripts,
      ),
    ).not.toThrow()
  })

  it('rejects a local check script that drops browser tests', () => {
    expect(() =>
      validateLocalCheckScripts({
        'check:quality':
          'pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build',
        check: 'pnpm check:quality',
      }),
    ).toThrow('Local pnpm check must run check:quality and then browser tests')
  })
})
