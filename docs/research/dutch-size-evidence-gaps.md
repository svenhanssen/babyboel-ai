# Dutch manufacturer size-evidence gaps

**Ticket:** [#27 — Resolve remaining Dutch manufacturer size evidence gaps](https://github.com/svenhanssen/babyboel-ai/issues/27)  
**Access date for every source below:** 2026-08-25  
**Market:** Netherlands  
**Scope:** Disposable diapers and ordinary diaper pants. Training/potty pants, swim pants, bedwetting pants, and reusable diapers remain out of scope under the existing taxonomy decision.

## Executive answer

First-party Dutch evidence resolves only part of the remaining gap set.

- Safe additions are the current Etos Woezel & Pip pants mappings (sizes 4–6), the Rascals/Rascal + Friends rename plus Rascals taped-diaper sizes 1–6, AH's January 2025 `Extra droog en zacht` launch timing and Beregoede size 4+, Naty BioEmbrace taped-diaper sizes 1–6, and LILLYDOO pants sizes 3–8.
- Pampers' own current Dutch pages contradict one another about Premium Protection Pants sizes 7–8.
- Harmonie Pants has an official page explicitly marked `-old`, but no current Dutch Pampers category or guide applicability.
- Trekpleister's current first-party evidence proves private-label taped diapers, not private-label pants.
- No Dutch Huggies product-line source was found; Kimberly-Clark explicitly warns that products referenced on its corporate site are US-market products that may not be available locally.
- Rascals ordinary diaper-pants applicability and the Muumi/Moomin alias remain unresolved without importing retailer or foreign-market mappings.

The safe rule remains: normalize exact numeric sizes only where a current Dutch brand-owner/private-label-owner source supports that product line and category; otherwise retain the raw source assertion and route it to manual review.

## Method and evidence boundary

This was a bounded pass in the ticket's requested order. Each gap received only targeted searches of official Dutch manufacturer/brand-owner pages, retailer-owned pages for the retailer's own label, and launch-retailer pages solely to identify which independent eco/specialist brands are visible. Independent retailer copy was **not** used to prove a third-party brand's normalized mapping.

Absence from a current category page is not proof that a product never existed or is unavailable in every channel. It is recorded as a current catalog signal, not a negative global fact.

## 1. Pampers Premium Protection Pants sizes 7–8

### Evidence

1. **Pampers Netherlands, all diaper pants**  
   URL: https://www.pampers.nl/luiers-doekjes/luierbroekjes  
   Accessed: 2026-08-25  
   Relevant evidence: “Pampers® Premium Protection™ Pants” is shown with “**MAAT 3 - 8**.”  
   Confidence/limitation: High confidence that the current Dutch category page makes this assertion. It is a range-level assertion, not a per-size SKU list.

2. **Pampers Netherlands, product-selection guide**  
   URL: https://www.pampers.nl/veiligheid-en-toewijding/luiers-en-doekjes/artikel/welke-luier-kies-je  
   Accessed: 2026-08-25  
   Relevant evidence: “Pampers® Premium Protection™ Pants, verkrijgbaar in **maat 3, 4, 5 en 6**”; the same guide separately says “Pampers Baby-Dry™ Pants zijn verkrijgbaar in maten **3, 4, 5, 6, 7 en 8**.”  
   Confidence/limitation: High confidence in the text, but it directly contradicts the current category page for Premium Protection Pants sizes 7–8.

### Finding and taxonomy disposition

The Dutch brand owner currently publishes contradictory applicability. Sizes 7 and 8 for **Premium Protection Pants** are therefore **not safe as line-level normalized applicability**.

- Keep the category-page `3–8` assertion and guide-page `3–6` assertion as separate, dated evidence.
- Create an evidence conflict for sizes 7 and 8.
- A listing that explicitly says `Premium Protection Pants maat 7` or `maat 8` may retain its exact raw numeric parse, but its line/category association must remain manual-review-only until a Dutch Pampers per-size page, structured product payload, or corrected guide resolves the conflict.

## 2. Current Harmonie Pants

### Evidence

1. **Pampers Netherlands, legacy Harmonie Pants page**  
   URL: https://www.pampers.nl/luiers-doekjes/pampers-harmonie-pants-old  
   Accessed: 2026-08-25  
   Relevant evidence: page title “**Pampers® Harmonie Pants**”; heading “**Luierbroekjes Pampers® Harmonie Pants**”; URL ends in `pampers-harmonie-pants-old`. No size range is exposed in the retrieved page.  
   Confidence/limitation: High confidence that Pampers itself documents the line historically; the `-old` URL and missing size data prevent treating it as current applicability.

2. **Pampers Netherlands, current all-products catalog**  
   URL: https://www.pampers.nl/luiers-doekjes  
   Accessed: 2026-08-25  
   Relevant evidence: the catalog lists “Pampers® Harmonie Luiers” at “**MAAT 1 - 6**,” while its pants entries are Baby-Dry Pants, Premium Protection Pants, Night Pants, and Splashers.  
   Confidence/limitation: High confidence about the current catalog contents at access time. Catalog omission does not prove channel-wide discontinuation.

3. **Pampers Netherlands, current selection guide**  
   URL: https://www.pampers.nl/veiligheid-en-toewijding/luiers-en-doekjes/artikel/welke-luier-kies-je  
   Accessed: 2026-08-25  
   Relevant evidence: under “Harmonie assortiment,” only “Pampers® Harmonie **luiers**” in sizes “**1, 2, 3, 4, 5 en 6**” are described; Harmonie Pants is not listed.  
   Confidence/limitation: High confidence about the guide; omission is not an explicit discontinuation statement.

### Finding and taxonomy disposition

`Pampers Harmonie Pants` is a verified historical Dutch line name, but current availability and all pants-size mappings remain unresolved.

- Preserve `Harmonie Pants` as a historical/source-scoped product-line assertion.
- Do not copy Harmonie taped-diaper sizes 1–6 onto pants.
- Do not mark the line definitively discontinued; use `historical_or_ambiguous` and manual review for current listings.

## 3. AH line/version timing and plus sizes

### Evidence

1. **Albert Heijn newsroom, launch of the renewed own-label diaper**  
   URL: https://nieuws.ah.nl/groot-nieuws-voor-de-kleintjes-albert-heijn-komt-met-verfrissend-baby--en-peuterassortiment/  
   Accessed: 2026-08-25  
   Relevant evidence: dated “**24 januari 2025**”; says “**Nieuw: eigen merk luier**”; names package assets such as `Luiers-Extra-Droog-Zacht` and `Luierbroekjes-Extra-Droog-Zacht`; and states “Het vernieuwde baby- en peuterassortiment is vanaf **maandag 27 januari** in alle winkels en online beschikbaar.”  
   Confidence/limitation: High confidence for the introduction date of the renewed Extra droog en zacht range. The release does not call it a rename of Beregoede.

2. **Albert Heijn, current diaper category**  
   URL: https://www.ah.nl/producten/4815/luiers  
   Accessed: 2026-08-25  
   Relevant evidence: the same current category lists both “**AH Extra droog en zacht luiers**” and multiple “**AH Beregoede**” diapers/diaper pants, including “AH Beregoede luiers maxi plus maat 4+.”  
   Confidence/limitation: High confidence that the lines coexist in the current online category at access time; this does not establish when Beregoede began.

3. **Albert Heijn, Beregoede size 4+ product**  
   URL: https://www.ah.nl/producten/product/wi468191/ah-beregoede-luiers-maxi-plus-maat-4  
   Accessed: 2026-08-25  
   Relevant evidence: title “**AH Beregoede luiers maxi plus maat 4+**”; description “**Luiers 4+ / 10-15 kg**”; but “Extra informatie” says “**Geschikt voor 9-14 kg**.” The supplier is “Albert Heijn B.V.”  
   Confidence/limitation: High confidence that `Maxi Plus` and `4+` belong together for this AH Beregoede taped-diaper SKU. Its two weight assertions conflict.

4. **Albert Heijn, current Extra droog en zacht examples**  
   URLs:  
   - https://www.ah.nl/producten/product/wi585830/ah-extra-droog-en-zacht-luiers-maat-4  
   - https://www.ah.nl/producten/product/wi585798/ah-extra-droog-en-zacht-luiers-maat-5  
   - https://www.ah.nl/producten/product/wi585825/ah-extra-droog-en-zacht-luiers-maat-6  
   Accessed: 2026-08-25  
   Relevant evidence: the pages call the products `4 maxi`, `5 junior`, and `6 extra large`, with exact numeric sizes 4, 5, and 6.  
   Confidence/limitation: High confidence for these current SKU-local aliases. They do not establish plus-size variants.

### Finding and taxonomy disposition

- Treat `AH Extra droog en zacht` as a new/renewed line available from **2025-01-27**.
- Do **not** alias `Beregoede` to `Extra droog en zacht`: AH currently exposes both, and no first-party rename statement was found.
- Safely map AH Beregoede taped-diaper `Maxi Plus` to `size_4_plus` for this line/version.
- Preserve both Beregoede 4+ weight assertions and flag the weight conflict; weight must not decide identity.
- No current first-party AH-own-label evidence was found for `5+` or `6+`. Do not create those mappings from Etos or other brands.
- Exact AH descriptors (`maxi`, `junior`, `extra large`) remain line/version/category scoped.

The start date of Beregoede and the precise replacement/supersession relationship between older and 2025 packages remain unresolved.

## 4. Trekpleister private-label pants

### Evidence

1. **Trekpleister, private-label taped diaper**  
   URL: https://www.trekpleister.nl/trekpleister-maat-4-maxi-valuepack-luiers/p/5593015  
   Accessed: 2026-08-25  
   Relevant evidence: title “**Trekpleister Maat 4 Maxi Valuepack Luiers**”; “Gewicht: ca. **8-14 kg**”; functional name “**Babyluiers (Wegwerpartikel)**”; market-responsible party “Trekpleister.”  
   Confidence/limitation: High confidence for the private-label taped-diaper mapping only.

2. **Trekpleister, current diaper-pants category**  
   URL: https://www.trekpleister.nl/baby/luierbroekjes  
   Accessed: 2026-08-25  
   Relevant evidence: the retrieved current products are Pampers and Rascals pants in sizes 4–8; no Trekpleister-labelled pants product was exposed.  
   Confidence/limitation: Medium confidence as a current catalog signal. The category is paginated and omission is not proof that a private-label pants line never existed.

### Finding and taxonomy disposition

Trekpleister private-label **pants remain unresolved**. The owner page verifies `Maxi → size_4` for a taped-diaper version, not pants.

- Keep the existing taped-diaper alias source-scoped.
- Do not transfer `Maxi`, 8–14 kg, or any private-label size range to pants.
- Any observed Trekpleister-labelled pants listing requires first-party SKU evidence or manual review.

## 5. Etos Woezel & Pip

### Evidence

1. **Etos pants size 4**  
   URL: https://www.etos.nl/producten/etos-woezel-pip-luierbroekjes-maxi-maat-4-8-15-kg-megabox-4x24-stuks-120705013.html  
   Accessed: 2026-08-25  
   Relevant evidence: title “**Etos Woezel & Pip Luierbroekjes Maxi Maat 4 8-15 kg**”; description says the product is suitable for “**8 tot 15 kg**” and has an “**exclusief Woezel & Pip design**.”  
   Confidence/limitation: High confidence; retailer and private-label owner are the same party.

2. **Etos pants size 5**  
   URL: https://www.etos.nl/producten/etos-woezel-pip-luierbroekjes-junior-maat-5-12-18-kg-megabox-66-stuks-120399600.html  
   Accessed: 2026-08-25  
   Relevant evidence: title “**Junior Maat 5 12-18 kg**”; description says suitable for “**12 tot 18 kg**” and calls Woezel & Pip an exclusive design.  
   Confidence/limitation: High confidence.

3. **Etos pants size 6**  
   URL: https://www.etos.nl/producten/etos-woezel-pip-luierbroekjes-xl-maat-6-16%2B-kg-megabox-4x30-stuks-120704416.html  
   Accessed: 2026-08-25  
   Relevant evidence: title “**XL Maat 6 16+ kg**”; description also calls it “**Extra Large 6**” and suitable for “**16+ kg**.”  
   Confidence/limitation: High confidence.

### Finding and taxonomy disposition

Safe pants aliases for the current Etos Woezel & Pip version are:

- `Maxi` → `size_4`
- `Junior` → `size_5`
- `XL` / `Extra Large` → `size_6`

Scope every alias to Netherlands + Etos + Woezel & Pip version + diaper pants. The pages explicitly describe Woezel & Pip as an **exclusive design**, so model `Etos` as the brand/private label and retain `Woezel & Pip` as a source-visible design/version name, not a global manufacturer alias.

## 6. Rascals

### Evidence

1. **Rascals Netherlands size guide**  
   URL: https://www.rascalsbaby.com/nl-nl/size-guide  
   Accessed: 2026-08-25  
   Relevant evidence: banner “**Een nieuwe look, dezelfde Rascal + Friends**”; taped-diaper table gives size 1 (3–5 kg), 2 (4–8 kg), 3 (6–11 kg), 4 (10–15 kg), 5 (13–18 kg), and 6 (16 kg+); FAQ says “Onze luiers zijn verkrijgbaar in de maten **1 tot 6** en onze trainingsbroekjes ... **2T-3T tot 5T-6T**.”  
   Confidence/limitation: High confidence for the rename and taped-diaper sizes 1–6. The pants statement concerns training pants, which are out of scope.

2. **Rascals Netherlands Premium Diapers product page**  
   URL: https://www.rascalsbaby.com/nl-nl/products/premium-diapers  
   Accessed: 2026-08-25  
   Relevant evidence: selectable variants are `1 2 3 4 5 6`, and the detailed size list also ends at 6; another sentence on the same page says “verkrijgbaar in de maten **Newborn - 7**.”  
   Confidence/limitation: High confidence that the page is internally inconsistent about size 7.

3. **Rascals Netherlands training-pants URL**  
   URL: https://www.rascalsbaby.com/nl-nl/products/premium-training-pants  
   Accessed: 2026-08-25  
   Relevant evidence: the Netherlands-localized URL redirected to a `country=en-us` target rather than exposing a stable Dutch product contract.  
   Confidence/limitation: High confidence in the redirect behavior at access time; US content cannot establish a Dutch mapping.

### Finding and taxonomy disposition

- Safe brand alias/rename: `Rascal + Friends` → `Rascals`, preserving validity dates as they become known.
- Safe current taped-diaper applicability: sizes 1–6 and the weight evidence above.
- Do not normalize taped-diaper size 7 without review because the Dutch page contradicts its own selectable variants and size table.
- Do not use 2T/3T labels as ordinary diaper-pants aliases.
- Current Dutch ordinary `Rascals ... Luierbroekjes` sizes 4–7 seen at retailers remain source observations only; the brand-owner Netherlands product URL redirects to US context, so ordinary pants applicability is unresolved.
- `CoComelon` remains a design/edition assertion, not a size or global line alias, until a stable Dutch brand-owner page states otherwise.

## 7. Huggies Dutch product lines

### Evidence

1. **Kimberly-Clark Netherlands terms of use**  
   URL: https://www.kimberly-clark.com/nl-nl/terms-of-use  
   Accessed: 2026-08-25  
   Relevant evidence: “De producten waarnaar op deze site wordt verwezen, zijn **beschikbaar in de Verenigde Staten en zijn mogelijk niet beschikbaar in uw land**”; Kimberly-Clark “verklaart niet” that product information is suitable or available in other locations.  
   Confidence/limitation: High confidence that US/global corporate product pages cannot prove a Netherlands product mapping.

2. **Targeted official-domain searches**  
   URLs searched: `huggies.nl`, `huggies.com/nl-nl`, and `kimberly-clark.com/nl-nl`  
   Accessed: 2026-08-25  
   Relevant evidence: no Dutch Huggies product-line or size page was found; only corporate/legal pages were returned.  
   Confidence/limitation: This is an unresolved search result, not proof of non-availability.

### Finding and taxonomy disposition

All Dutch Huggies line aliases and line/category size applicability remain **unresolved**.

- Do not import `Little Movers`, `Little Snugglers`, `Extra Care`, `Ultra Comfort`, `DryNites`, or any size range from US, Canadian, UK, or other foreign pages.
- Dutch retailer listings may preserve exact raw product names and exact numeric size tokens.
- Any proposed equivalence between Dutch listing names and foreign Huggies lines is manual-review-only until Dutch first-party evidence exists.

## 8. Launch-visible eco/specialist brands

The bounded launch-visible set was identified from launch-retailer pages, then mappings were accepted only from Dutch/Netherlands-localized brand-owner pages.

### Visibility evidence

1. **Etos diaper advice**  
   URL: https://www.etos.nl/advies/baby/luiers/  
   Accessed: 2026-08-25  
   Relevant evidence: “Bij Etos vind je luiers van ... **Naty, Lillydoo en HappyBear**.”  
   Confidence/limitation: High confidence as Etos assortment/editorial evidence at access time; it does not prove third-party brand mappings.

2. **Plein Naty brand page**  
   URL: https://www.plein.nl/merken/naty/  
   Accessed: 2026-08-25  
   Relevant evidence: current results include Naty taped diapers and “**Naty Luierbroekjes Maat 5 (12-18 kg)**.”  
   Confidence/limitation: High confidence for launch-retailer visibility; mappings below rely on Naty itself.

3. **Plein Muumi product URL**  
   URL: https://www.plein.nl/muumi-baby-ecologische-luierbroekjes-maat-7-16-26kg-34-stuks  
   Accessed: 2026-08-25  
   Relevant evidence: the first-party retailer URL identifies a Muumi Baby pants offer, but direct retrieval was blocked by the retailer's security service.  
   Confidence/limitation: Medium confidence for visibility from the indexed first-party URL; insufficient for a normalized brand mapping.

### Naty / Eco by Naty / BioEmbrace

1. **Naty Netherlands BioEmbrace diapers**  
   URL: https://www.naty.com/nl/nl/voor-baby/bioembrace-luiers/bioembrace-luiers/51000.html  
   Accessed: 2026-08-25  
   Relevant evidence: Netherlands/Dutch selector; sizes 1 (2–5 kg), 2 (3–6 kg), 3 (4–9 kg), 4 (7–18 kg), 5 (11–25 kg), 6 (16+ kg); “**Van de originele Naty-luiers — nu vernieuwd als BioEmbrace**.”  
   Confidence/limitation: High confidence for current taped diapers and the line-version relationship. The page does not date the change.

2. **Naty Netherlands Original Training Pants**  
   URL: https://www.naty.com/nl/en/for-baby/freemovers-diaper-pants/original-training-pants/31502.html  
   Accessed: 2026-08-25  
   Relevant evidence: Netherlands market selector and sizes 4 (8–15 kg), 5 (12–18 kg), 6 (16+ kg), 7 (17+ kg), and 8 (17+ kg), but the product is explicitly titled “**Original Training Pants**.”  
   Confidence/limitation: High confidence for the Netherlands offer; category semantics are training pants and therefore out of launch scope.

**Disposition:** safely add Naty BioEmbrace taped-diaper sizes 1–6 and a version relation from original Naty diapers to BioEmbrace. Keep `Eco by Naty`, `Naty`, and `BioEmbrace` as explicit brand/line/version fields rather than collapsing every name into one global alias. Do not import the training-pants range into ordinary diaper pants.

### LILLYDOO

1. **LILLYDOO Netherlands diaper pants**  
   URL: https://lillydoo.com/nl-nl/products/luierbroekjes-lillydoo  
   Accessed: 2026-08-25  
   Relevant evidence: Dutch page and table: size 3 (6–10 kg), 4 (9–14 kg), 5 (11–16 kg), 6 (13+ kg), 7 (15+ kg), and 8 (17+ kg); the page distinguishes pants by their elastic waistband and tear-open sides.  
   Confidence/limitation: High confidence for current Netherlands ordinary diaper pants.

**Disposition:** safely add LILLYDOO ordinary pants applicability for sizes 3–8 with the quoted weight evidence. `N°` is presentation syntax around the exact number, not a separate size system.

### Muumi / Moomin

No Dutch/Netherlands-localized manufacturer page was found in the bounded pass. Search results exposed foreign/global material and Dutch retailer spellings `Muumi Baby` and `Moomin Baby`, but that does not prove a Dutch brand alias or size table.

**Disposition:** preserve each retailer's raw spelling and exact numeric token; keep `Muumi ↔ Moomin` equivalence, descriptive aliases such as `Maxi+`, and all line/category applicability manual-review-only.

### HappyBear and other specialist products

The Etos-visible HappyBear example is a reusable, adjustable diaper. Reusable and one-size products are outside the disposable diaper/ordinary pants taxonomy.

**Disposition:** classify as out of scope rather than mapping `one size` to any canonical disposable size. Other eco brands not positively identified on the bounded launch-retailer pass remain unresolved; do not import global brand charts.

## Safe taxonomy patch

The following can safely enter a patch release of `diaper-size-nl@1.0.0`:

1. Etos Woezel & Pip pants:
   - `Maxi` → `size_4`
   - `Junior` → `size_5`
   - `XL` / `Extra Large` → `size_6`
2. AH:
   - line/version fact: `Extra droog en zacht` available from 2025-01-27
   - `Beregoede` `Maxi Plus` → taped-diaper `size_4_plus`
   - explicit evidence conflict between 10–15 kg and 9–14 kg for that SKU
3. Rascals:
   - brand rename relation `Rascal + Friends` → `Rascals`
   - taped-diaper sizes 1–6 with source weights
4. Naty:
   - original Naty diaper line renewed as `BioEmbrace`
   - BioEmbrace taped-diaper sizes 1–6 with source weights
5. LILLYDOO:
   - ordinary pants sizes 3–8 with source weights

Every alias above must remain scoped by market, brand, line/version, category, and evidence validity. None is a global Dutch alias.

## Manual-review-only and unresolved

- Premium Protection Pants sizes 7–8: contradictory current Pampers sources.
- Current Harmonie Pants status and every pants size: only a legacy `-old` page plus current omission.
- AH Beregoede start date and exact supersession/version relationship; AH-own-label 5+ and 6+.
- Trekpleister private-label pants existence and mappings.
- Rascals taped-diaper size 7 and ordinary pants sizes/category semantics.
- All Dutch Huggies product-line aliases and applicability.
- Muumi/Moomin alias, Dutch line names, and sizes.
- Naty `Original Training Pants` as ordinary pants: explicitly out of scope unless the category policy changes.
- Any additional eco/specialist brand lacking a Netherlands-localized brand-owner source.

## Proposed issue resolution comment

> Bounded first-party research resolves this ticket only partially, but enough to close the research pass without importing foreign mappings.
>
> Safe taxonomy patch: add current Etos Woezel & Pip pants aliases (`Maxi`→4, `Junior`→5, `XL/Extra Large`→6); record AH Extra droog en zacht as launched 2025-01-27 while keeping Beregoede separate, and map Beregoede Maxi Plus to taped size 4+ with its 10–15/9–14 kg conflict preserved; record `Rascal + Friends`→`Rascals` and Rascals taped sizes 1–6; record original Naty diapers→BioEmbrace with taped sizes 1–6; and add LILLYDOO ordinary pants sizes 3–8.
>
> Keep manual-review-only: Pampers Premium Protection Pants 7–8 (Pampers' current category says 3–8 while its guide says 3–6), current Harmonie Pants (only an official `-old` page, no current sizes), Trekpleister private-label pants, Rascals taped size 7 and ordinary pants mappings, every Dutch Huggies line alias, and Muumi/Moomin equivalence. Do not import US/Canadian/UK Huggies or other foreign-market charts. Naty's size 4–8 product is explicitly Training Pants and remains out of ordinary-pants scope.
>
> Findings: `docs/research/dutch-size-evidence-gaps.md`.
