import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createD1TestDatabase, type D1TestDatabase } from './d1'

describe('D1 test boundary performance', () => {
  let database: D1TestDatabase

  beforeAll(async () => {
    database = await createD1TestDatabase()
  })

  afterAll(async () => {
    await database.close()
  })

  it('executes repeated statements without per-statement process startup', async () => {
    const startedAt = performance.now()

    for (let index = 0; index < 10; index += 1) {
      await expect(
        database.execute<{ value: number }>('SELECT 1 AS value'),
      ).resolves.toEqual([{ value: 1 }])
    }

    expect(performance.now() - startedAt).toBeLessThan(2_000)
  })
})
