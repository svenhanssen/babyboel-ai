import { spawnSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type D1Result<Row> = {
  results: Row[]
  success: boolean
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

  return {
    execute,
    executeFile,
    close: () => rm(persistencePath, { recursive: true, force: true }),
  }
}

export type D1TestDatabase = Awaited<ReturnType<typeof createD1TestDatabase>>
