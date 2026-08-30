import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    fileParallelism: false,
    testTimeout: 30_000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})
