# Babyboel

Babyboel is a Dutch, evidence-backed comparison product for diapers, diaper
pants, and wipes. This repository contains one TanStack Start package deployed
as one Cloudflare Worker for public routes, Admin routes, and scheduled
acquisition.

## Architecture

- **TanStack Start + React** provide server-rendered public and Admin routes.
- **Cloudflare Workers** hosts the application and the scheduled entrypoint.
- **D1 + Drizzle** hold normalized current catalog state, append-only source
  observations, private evidence metadata, Review state, and compact audit
  facts. There is no replay or projection layer.
- **R2** will hold bounded evidence artifacts.
- **Cloudflare Email** is declared for later operational alerts.
- **Fixture mode** is mandatory locally and in previews. Production acquisition
  starts disabled and is activated only through the retailer activation gates.

The checked-in D1 UUIDs are unmistakable non-working placeholders. Issue #79
replaces them with provisioned local/preview/production resource IDs. Secrets
belong in Cloudflare and GitHub environments, never in this repository.

## Requirements

- Node.js 24
- pnpm 9.7.0

Install dependencies:

```sh
pnpm install --frozen-lockfile
```

## Local development

```sh
pnpm dev
```

This starts the public app and the `/admin` placeholder with local D1/R2/email
emulation. No retailer network access is possible because local configuration
is fixture-only.

The Worker exposes its scheduled-handler test endpoint while Vite is running:

```sh
curl "http://localhost:3000/cdn-cgi/handler/scheduled?cron=17+0,6,12,18+*+*+*"
```

## Quality commands

```sh
pnpm format:check
pnpm lint
pnpm validate:config
pnpm validate:migrations
pnpm cf-typegen:check
pnpm typecheck
pnpm test
pnpm build
```

Run all gates with `pnpm check`. Configuration validation fails if preview
acquisition is not fixture-only or preview D1/R2 names match production.
Migration validation checks Drizzle metadata and schema drift, strict tables,
append-only observation/audit triggers, forward numbering, and application of
all migrations to a fresh local D1 store.

## Database changes

Edit `src/db/schema.ts`, then generate and review a forward-only migration:

```sh
pnpm db:generate
pnpm validate:migrations
pnpm db:migrate:local
```

The deterministic integration fixture is
`tests/fixtures/catalog.sql`. Database tests apply migrations to an isolated
local D1 store and verify constraints, observation idempotency, append-only
history, and query plans without external credentials.

## Environments

`wrangler.jsonc` defines three isolated environments:

- default/local: emulated bindings and fixture acquisition;
- `preview`: separate bindings and fixture acquisition only;
- `production`: separate bindings with acquisition disabled by default.

With the Cloudflare Vite plugin, select named environments at build time:

```sh
CLOUDFLARE_ENV=preview pnpm build
CLOUDFLARE_ENV=production pnpm build
```

Preview and production deployment steps remain inactive until their GitHub
environments contain `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
Production smoke hooks additionally use `PUBLIC_SMOKE_URL`,
`PROTECTED_SMOKE_URL`, and `PROTECTED_SMOKE_TOKEN` when configured.

## Delivery and rollback

The delivery workflow runs the same quality commands as local development.
Pull requests build a fixture-only protected preview. Pushes to `main` serialize
production releases, apply backward-compatible migrations before deployment,
and run configured public/protected smoke checks.

D1 migrations are forward-only and are not rolled back with Worker code.
After a bad compatible deployment, inspect versions and restore the prior
Worker version:

```sh
pnpm exec wrangler versions list --env production
pnpm exec wrangler rollback <VERSION_ID> --env production
```

Production credentials, environment protection rules, real resources, and a
rehearsed rollback are provisioned in issue #79.
