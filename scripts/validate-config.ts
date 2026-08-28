import { readFile } from 'node:fs/promises'

import { parse } from 'jsonc-parser'

import { validateDeploymentConfig } from '../src/config-safety'

const configSource = await readFile(
  new URL('../wrangler.jsonc', import.meta.url),
  'utf8',
)

validateDeploymentConfig(parse(configSource))
console.log('Deployment configuration keeps preview resources isolated.')
