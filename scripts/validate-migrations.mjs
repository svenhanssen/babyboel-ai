import { readFile, readdir, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const migrationsDirectory = new URL('../migrations/', import.meta.url)
const entries = await readdir(migrationsDirectory)
const migrations = entries.filter((entry) => entry.endsWith('.sql')).sort()
const migrationPattern = /^(\d{4})_[a-z0-9_]+\.sql$/

for (const [index, migration] of migrations.entries()) {
  const match = migrationPattern.exec(migration)

  if (!match) {
    throw new Error(
      `Migration ${migration} must use the 0000_descriptive_name.sql format`,
    )
  }

  const expectedNumber = String(index).padStart(4, '0')
  if (match[1] !== expectedNumber) {
    throw new Error(
      `Migration ${migration} must be numbered ${expectedNumber} in sequence`,
    )
  }
}

if (migrations.length > 0) {
  const drizzleCheck = spawnSync('pnpm', ['exec', 'drizzle-kit', 'check'], {
    encoding: 'utf8',
    stdio: 'inherit',
  })

  if (drizzleCheck.status !== 0) {
    throw new Error('Drizzle migration metadata is inconsistent')
  }

  const schemaCheckPath = '.wrangler/schema-check'
  await rm(new URL(`../${schemaCheckPath}/`, import.meta.url), {
    recursive: true,
    force: true,
  })

  const generatedSchema = spawnSync(
    'pnpm',
    [
      'exec',
      'drizzle-kit',
      'generate',
      '--dialect=sqlite',
      '--schema=./src/db/schema.ts',
      `--out=${schemaCheckPath}`,
      '--name=snapshot',
    ],
    { encoding: 'utf8', stdio: 'inherit' },
  )

  if (generatedSchema.status !== 0) {
    throw new Error('Unable to regenerate the Drizzle schema snapshot')
  }

  const committedSnapshots = (
    await readdir(new URL('../migrations/meta/', import.meta.url))
  )
    .filter((entry) => /^\d{4}_snapshot\.json$/.test(entry))
    .sort()
  const latestSnapshot = committedSnapshots.at(-1)

  if (!latestSnapshot) {
    throw new Error('A committed Drizzle schema snapshot is required')
  }

  const committedSchema = JSON.parse(
    await readFile(
      new URL(`../migrations/meta/${latestSnapshot}`, import.meta.url),
      'utf8',
    ),
  )
  const regeneratedSchema = JSON.parse(
    await readFile(
      new URL(`../${schemaCheckPath}/meta/0000_snapshot.json`, import.meta.url),
      'utf8',
    ),
  )
  delete committedSchema.id
  delete committedSchema.prevId
  delete regeneratedSchema.id
  delete regeneratedSchema.prevId

  if (JSON.stringify(committedSchema) !== JSON.stringify(regeneratedSchema)) {
    throw new Error(
      'Drizzle schema drift detected; generate and review a migration',
    )
  }

  await rm(new URL(`../${schemaCheckPath}/`, import.meta.url), {
    recursive: true,
    force: true,
  })

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

  const guarantees = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      `--persist-to=${persistencePath}`,
      "--command=SELECT (SELECT COUNT(*) FROM pragma_table_list WHERE schema = 'main' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_METADATA', 'd1_migrations') AND strict = 1) AS strict_tables, (SELECT COUNT(*) FROM sqlite_schema WHERE type = 'trigger' AND name IN ('source_observations_reject_update', 'source_observations_reject_delete', 'audit_log_reject_update', 'audit_log_reject_delete')) AS append_only_triggers, (SELECT COUNT(*) FROM sqlite_schema WHERE type = 'trigger' AND name IN ('offers_validate_total_units_insert', 'offers_validate_total_units_update')) AS offer_unit_triggers",
      '--json',
    ],
    { encoding: 'utf8' },
  )

  if (guarantees.status !== 0) {
    throw new Error('Unable to inspect the migrated D1 schema')
  }

  const [execution] = JSON.parse(guarantees.stdout)
  const [counts] = execution.results
  if (
    counts.strict_tables !== 14 ||
    counts.append_only_triggers !== 4 ||
    counts.offer_unit_triggers !== 2
  ) {
    throw new Error(
      'Migrated D1 schema must contain 14 strict tables and all invariant triggers',
    )
  }
}

console.log(`Validated ${migrations.length} migration(s).`)
