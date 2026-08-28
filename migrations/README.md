# D1 migrations

Forward-only D1 migrations belong here as sequentially numbered SQL files:
`0001_descriptive_name.sql`, `0002_next_change.sql`, and so on.

The schema baseline is intentionally deferred to issue #69. The validation
command already checks numbering and applies every migration to a fresh local
D1 store once migrations exist.
