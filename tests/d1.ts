import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type D1Result<Row> = {
  results: Row[]
  success: boolean
}

const quoteSqlValue = (value: unknown) => {
  if (value === null) return 'NULL'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Unsupported SQL number')
    return String(value)
  }
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`
  throw new Error(`Unsupported SQL value: ${typeof value}`)
}

const bindSql = (sql: string, values: unknown[]) => {
  let index = 0
  const bound = sql.replaceAll('?', () => {
    if (index >= values.length) throw new Error('Missing SQL binding')
    return quoteSqlValue(values[index++])
  })
  if (index !== values.length) throw new Error('Unused SQL binding')
  return bound
}

const runWrangler = (args: string[]) =>
  spawnSync('pnpm', ['exec', 'wrangler', 'd1', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  })

export const createD1TestDatabase = async () => {
  const persistencePath = await mkdtemp(join(tmpdir(), 'babyboel-d1-'))
  const migration = runWrangler([
    'migrations',
    'apply',
    'DB',
    '--local',
    `--persist-to=${persistencePath}`,
  ])

  if (migration.status !== 0) {
    await rm(persistencePath, { recursive: true, force: true })
    throw new Error(
      `Unable to apply D1 migrations:\n${migration.stdout}\n${migration.stderr}`,
    )
  }

  const execute = <Row = Record<string, unknown>>(sql: string) => {
    const result = runWrangler([
      'execute',
      'DB',
      '--local',
      `--persist-to=${persistencePath}`,
      `--command=${sql}`,
      '--json',
    ])

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout)
    }

    const output = JSON.parse(result.stdout) as D1Result<Row>[]
    return output.flatMap((entry) => entry.results)
  }

  const executeFile = (path: string) => {
    const result = runWrangler([
      'execute',
      'DB',
      '--local',
      `--persist-to=${persistencePath}`,
      `--file=${path}`,
    ])

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout)
    }
  }

  const prepare = (sql: string) => {
    const statement = (values: unknown[]) => {
      const run = () => {
        const bound = bindSql(sql, values)
        return execute(bound)
      }
      return {
        bind: (...nextValues: unknown[]) => statement(nextValues),
        all: () =>
          Promise.resolve({
            results: run(),
            success: true,
            meta: {},
          }),
        first: (column?: string) => {
          const [row] = run()
          return Promise.resolve(
            column ? (row?.[column] ?? null) : (row ?? null),
          )
        },
        raw: () => Promise.resolve(run().map((row) => Object.values(row))),
        run: () =>
          Promise.resolve({
            results: run(),
            success: true,
            meta: {},
          }),
      }
    }
    return statement([])
  }

  return {
    execute,
    executeFile,
    binding: {
      prepare,
      batch: async (statements: ReturnType<Env['DB']['prepare']>[]) => {
        const results = []
        for (const statement of statements) {
          results.push(await statement.run())
        }
        return results
      },
      exec: (sql: string) => {
        execute(sql)
        return Promise.resolve({ count: 0, duration: 0 })
      },
      dump: () => Promise.resolve(new ArrayBuffer(0)),
      withSession: () => {
        throw new Error('D1 sessions are not available in this test helper')
      },
    } as unknown as Env['DB'],
    close: () => rm(persistencePath, { recursive: true, force: true }),
  }
}

export type D1TestDatabase = Awaited<ReturnType<typeof createD1TestDatabase>>
