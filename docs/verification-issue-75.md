# Issue 75 verification

## Automated coverage

- Vitest covers fixture categories and normalized sizes, exact Offer ranking,
  restricted separation, 24-Product pagination, stale suppression, degraded
  fail-closed behavior, alternatives, and invalid query bounds.
- Playwright covers finder → browse → Product → retailer destination,
  Previous/Next pagination and self-canonicals, page boundaries, restricted
  Offers, stale and degraded Product states, invalid finder combinations, live
  trust links, and the critical path with JavaScript disabled.
- Axe reports no violations on the representative Product page. The mobile
  browser check verifies the skip link receives first keyboard focus, the
  history table remains reachable, and the 390 px layout has no page-level
  horizontal overflow.

Run the complete gate with `pnpm check`. CI installs Chromium before this gate.

## Mobile performance check

Lighthouse 13.0.1 was run twice against the production build through
`vite preview`, using its default simulated mobile profile:

- performance: 78–79
- accessibility: 100
- FCP: 3.6 s
- LCP: 4.1 s
- TBT: 10–30 ms
- CLS: 0
- transferred: 526 KiB

### Deliberate exception

The local simulated LCP does not yet meet the 2.5 s “good” threshold. Lighthouse
attributes the largest opportunity to about 186 KiB of unused client JavaScript
from the current TanStack Start hydration baseline. The page remains ordinary
SSR and fully functional without JavaScript, with low blocking time and no
layout shift. Treat this as a launch-gate exception, not a passing Core Web
Vital: remeasure on the deployed fixture preview and remove or narrow public
hydration before the manual launch gate if field-like LCP remains above 2.5 s.

## Manual launch checks still required

The browser automation provides semantic and keyboard evidence but does not
replace a human screen-reader pass. Before public launch, complete the
representative mobile screen-reader check and confirm the outbound affiliate
attribution in the authorized retailer environment.
