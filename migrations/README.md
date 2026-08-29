# D1 migrations

Forward-only D1 migrations belong here as sequentially numbered SQL files:
`0000_descriptive_name.sql`, `0001_next_change.sql`, and so on. Drizzle Kit
owns the numbering and metadata under `meta/`.

Production migrations only move forward. A release applies a reviewed,
backward-compatible migration before deploying code that depends on it.
Rolling back a Worker version does not roll back D1, so destructive changes
must be split across releases and deferred until old code no longer depends on
the affected schema.

`pnpm validate:migrations` checks numbering, Drizzle metadata, schema drift,
strict-table and append-only guarantees, then applies every migration to a
fresh local D1 store.
