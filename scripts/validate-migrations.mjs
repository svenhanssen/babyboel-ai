import { readdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const migrationsDirectory = new URL('../migrations/', import.meta.url)
const entries = await readdir(migrationsDirectory)
const migrations = entries.filter((entry) => entry.endsWith('.sql')).sort()
const migrationPattern = /^(\d{4})_[a-z0-9_]+\.sql$/

for (const [index, migration] of migrations.entries()) {
  const match = migrationPattern.exec(migration)

  if (!match) {
    throw new Error(
      `Migration ${migration} must use the 0001_descriptive_name.sql format`,
    )
  }

  const expectedNumber = String(index + 1).padStart(4, '0')
  if (match[1] !== expectedNumber) {
    throw new Error(
      `Migration ${migration} must be numbered ${expectedNumber} in sequence`,
    )
  }
}

if (migrations.length > 0) {
  const persistencePath = '.wrangler/migration-check'
  await rm(new URL(`../${persistencePath}/`, import.meta.url), {
    recursive: true,
    force: true,
  })

  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'migrations',
      'apply',
      'DB',
      '--local',
      `--persist-to=${persistencePath}`,
    ],
    { encoding: 'utf8', stdio: 'inherit' },
  )

  if (result.status !== 0) {
    throw new Error('D1 migrations did not apply cleanly from an empty store')
  }
}

console.log(`Validated ${migrations.length} migration(s).`)
