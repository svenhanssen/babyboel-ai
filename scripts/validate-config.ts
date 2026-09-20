import { readFile } from 'node:fs/promises'

import { parse } from 'jsonc-parser'

import { validateDeploymentConfig } from '../src/config-safety'
import {
  validateLocalCheckScripts,
  validatePlaywrightDelivery,
} from '../src/playwright-ci'

const configSource = await readFile(
  new URL('../wrangler.jsonc', import.meta.url),
  'utf8',
)

validateDeploymentConfig(parse(configSource))

const [lockfile, workflow, packageSource] = await Promise.all([
  readFile(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8'),
  readFile(
    new URL('../.github/workflows/delivery.yml', import.meta.url),
    'utf8',
  ),
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
])

validatePlaywrightDelivery({ lockfile, workflow })
validateLocalCheckScripts(
  (JSON.parse(packageSource) as { scripts: Record<string, string> }).scripts,
)
console.log(
  'Deployment configuration keeps preview resources isolated and Playwright CI aligned.',
)
