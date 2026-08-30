# Babyboel operations

Babyboel is operated on a best-effort basis by one operator; it has no 24/7
response promise. Automatic trust controls must continue to suppress stale,
unauthorized, or questionable Offers without waiting for an operator.

Start every incident at the Access-protected `/admin/health` page. It derives
Retailer Runs, authorization, freshness, Review, retention, alert-delivery, and
backup facts from D1. Follow its Cloudflare observability link for request logs
and traces. Record UTC times, the deployment ID, safe error codes, affected
Retailers, containment, and verification; never copy credentials, Access
assertions, cookies, raw retailer payloads, personal data, or private evidence
into an issue or chat.

Operator contact and escalation details live in the protected account recovery
record, not this repository. Contractual or legal objections go to the named
source-rights contact and qualified Dutch counsel. Suspected account compromise
also follows the Cloudflare and GitHub account-recovery contacts in that record.

## Retailer acquisition, authorization, or freshness failure

Inspect the latest Retailer Run, source authorization status and expiry,
freshness boundary, current Offer count, and associated open Reviews. In
Cloudflare, use the deployment ID, run ID, Retailer ID, and safe error code to
find the corresponding logs or trace.

Containment:

- For a rights objection, revoked or uncertain authorization, compromised
  destination, or data-integrity risk, set only the affected Retailer to
  `paused`. The acquisition gate and public query both fail closed for a paused
  Retailer. Preserve other trustworthy Retailers.
- For an ordinary transient failure, do not rewrite current facts. The 48-hour
  freshness boundary suppresses unconfirmed Offers automatically.
- Do not bypass `401`, `403`, `429`, authentication, CAPTCHA, rate, or source
  controls. Do not switch to public-page or proxy acquisition.

Recover by resolving the actual authorization, configuration, destination, or
adapter problem; run its fixtures; then perform one protected manual run through
the ordinary acquisition path. Repeat the three-sweep/24-hour activation check
only when the source or failure invalidated that evidence. Verify a complete
run, representative exact Listing/seller destinations, current Offer timestamps,
and absence of new blocking Reviews before reactivating the Retailer.

Capture the run ID, authorization record revision, adapter fixture result,
representative checks, activation decision, and final Admin health state.

## Bad deployment or migration

Inspect the GitHub Actions run, deployment smoke result, public `/health`,
protected `/admin/health`, Cloudflare Worker versions, and the D1 migration
journal. First decide whether the failure is application code, configuration,
or a forward-only D1 migration.

Containment:

- Stop another production deployment until the failing release is understood.
- If trustworthy output could be wrong, disable acquisition or pause only the
  affected Retailer while keeping safe reads available.
- Never reverse a D1 migration or restore an older database underneath newer
  writes merely to match an older Worker.

For an application-only failure, inspect available versions with
`pnpm exec wrangler versions list --env production` and use
`pnpm exec wrangler rollback <VERSION_ID> --env production` only after verifying
the chosen version is schema-compatible. For a migration failure, prefer a new
forward-compatible migration and Worker repair. Commands containing real
resource IDs or restore targets must come from the protected recovery record
and be rehearsed before production use; they are intentionally not copied here.

Verify `/health`, the protected health page, one representative public query,
Admin authentication, the next fixture/manual acquisition path where relevant,
and the deployment smoke checks. Capture the workflow/deployment/version IDs,
migration number, decision, verification responses, and any follow-up issue.

## Authentication, credential, evidence-access, or security incident

Inspect Cloudflare Access audit facts, Worker request-failure events, scoped
token activity, GitHub environment activity, and evidence-access records. Keep
Access assertions, tokens, cookies, private agreement pointers, and raw evidence
out of ordinary logs and tickets.

Containment:

- Disable or rotate only the suspected credential/token through its owning
  Cloudflare, GitHub, retailer, or email control plane.
- Remove unauthorized Access sessions and preserve relevant provider audit
  evidence.
- If a source credential or destination may affect public truth, pause that
  Retailer immediately. If public-data safety may be broadly compromised,
  disable production acquisition and suppress affected publication paths.
- Do not delete Audit Log, Source Observation, or sanitized evidence facts.

Recover by applying least-privilege replacement credentials in protected
environment storage, reviewing Access issuer/audience/operator configuration,
and validating the exact affected path. Verify denied access for the old
credential, successful access for the intended operator or service, no secret
in application logs, and trustworthy public output. Capture provider audit
references, rotation time, affected scope, verification, and counsel or data
protection escalation when applicable.

## Source shutdown or retailer objection

Pause the Retailer immediately, stop acquisition, and suppress its Offers and
outbound actions without waiting for freshness expiry. Preserve the short
source-authorization record, compact observations, audits, and any evidence
whose deletion is not yet authorized or whose retention is legally required.
Follow the documented source-specific deletion obligation; never infer one from
the default 90-day raw-artifact limit.

Resume only after explicit authorization or qualified counsel resolves the
objection, the rights record is updated in a reviewed commit, adapter fixtures
pass, and the appropriate reactivation checks succeed. Capture the objection,
contact/counsel reference, pause time, affected facts, deletion actions, and
final disposition without copying private correspondence into Git.

## Evidence retention failure

Inspect the `evidence_cleanup` system check and safe error code. Cleanup is
bounded and idempotent: an R2 object is marked deleted in D1 only after its
delete call succeeds, so a later scheduled run can retry failures. Do not bulk
edit retention deadlines or delete compact Source Observations, Audit Log rows,
or sanctioned sanitized evidence.

After correcting R2 access or a source-specific deadline, allow the scheduled
cleanup to retry. Verify that due raw objects are absent, their D1 metadata has
`deleted_at`, non-due/protected evidence remains, and the system check returns
to `ok`. Capture counts and safe object prefixes, never raw object content.

## D1/R2 restore and account recovery

Use the protected recovery record for the exact production database/bucket,
encrypted backup location, tested restore commands, recovery codes, and provider
contacts. Confirm the target account, environment, timestamp, and scope with a
second read-back before any destructive restore or replacement. Preserve the
current failed state and provider audit evidence when possible.

Restore into an isolated resource first. Validate migration history, row and
referential-integrity checks, current Offer freshness, Review/Audit preservation,
evidence checksums/metadata, and representative private R2 access. Switch a
production binding only after the isolated verification and a recorded rollback
point. Account recovery follows Cloudflare and GitHub's current official
procedures from a known-clean device; do not paste recovery codes into a shell
transcript, issue, or chat.

Verify `/health`, `/admin/health`, representative public and Admin reads, scoped
credentials, scheduled trigger configuration, email alert delivery, and the
next safe backup/restore check. Capture provider case IDs, backup timestamp,
restored resource identity, verification results, binding change, and the next
backup deadline.
