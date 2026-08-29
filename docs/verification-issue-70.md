# Visual foundation verification

Checked on 2026-08-29 for issue #70. Screenshots were captured as review
artifacts in the implementation session rather than retained as a visual
regression suite.

## Viewport and theme checks

- Public home: light and dark at 1024 × 768.
- Public home: light and dark at 375 × 812.
- Admin foundation: dark at 1024 × 768.
- At 375 CSS px with text enlarged to 200%, the page had no horizontal
  overflow. The price-history table remained keyboard-focusable and scrolled
  within its labelled region.
- All public shell links and buttons measured at least 44 × 44 CSS px on the
  touch viewport.

## Accessibility checks

- Keyboard focus styles and the skip-link target were inspected.
- Forced-colors mode preserved boundaries, content, and control labels.
- Reduced-motion mode reduced transition durations to effectively zero.
- The theme button exposed the useful opposite theme in its accessible name.
- Axe reported no violations for the representative shell, theme control, and
  price-history chart/table. Color contrast was checked separately because
  jsdom cannot evaluate rendered color contrast.

## Contrast checks

Calculated WCAG contrast ratios for the locked palette:

- Light text/page: 15.49:1; muted text/page: 6.52:1.
- Light primary/page: 7.15:1; primary ink/action: 7.42:1.
- Light focus/page: 5.77:1; border/page: 3.13:1.
- Dark text/page: 17.68:1; muted text/page: 10.72:1.
- Dark primary/page: 8.82:1; primary ink/action: 8.25:1.
- Dark focus/page: 9.26:1; border/page: 3.10:1.

## Production assets

The production build emitted only the three used Dutch-Latin-capable WOFF2
faces: Inter 400 (23.66 kB), Inter 600 (24.45 kB), and Fredoka 600 (16.46 kB).
All three above-the-fold faces are preloaded, use resilient local/system
fallbacks, and are covered by the bundled SIL Open Font License notice.
