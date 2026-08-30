import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

import { Miniflare } from 'miniflare'
import { unstable_splitSqlQuery as splitSqlQuery } from 'wrangler'

const migrationsPath = resolve('migrations')

export const createD1TestDatabase = async () => {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default {}',
    d1Databases: {
      DB: '00000000-0000-0000-0000-000000000000',
    },
  })
  // Miniflare's D1 type is structurally compatible with the generated binding,
  // but typescript-eslint cannot resolve its bundled Workers type declaration.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const binding: Env['DB'] = await miniflare.getD1Database('DB')

  const runStatements = <Row = Record<string, unknown>>(
    sql: string,
  ): Promise<{ results: Row[] }[]> => {
    const statements = splitSqlQuery(sql).map((query) => binding.prepare(query))
    return statements.length === 0
      ? Promise.resolve([])
      : binding.batch<Row>(statements)
  }

  const migrationFiles = (await readdir(migrationsPath))
    .filter((file) => file.endsWith('.sql'))
    .sort()
  for (const migrationFile of migrationFiles) {
    await runStatements(
      await readFile(resolve(migrationsPath, migrationFile), 'utf8'),
    )
  }

  const executeDetailed = async <Row = Record<string, unknown>>(
    sql: string,
  ) => {
    return runStatements<Row>(sql)
  }
  const execute = async <Row = Record<string, unknown>>(sql: string) =>
    (await executeDetailed<Row>(sql)).flatMap(
      (entry: { results: Row[] }) => entry.results,
    )

  const executeFile = async (path: string) => {
    await runStatements(await readFile(path, 'utf8'))
  }

  return {
    execute,
    executeFile,
    binding,
    close: () => miniflare.dispose(),
  }
}

export type D1TestDatabase = Awaited<ReturnType<typeof createD1TestDatabase>>
