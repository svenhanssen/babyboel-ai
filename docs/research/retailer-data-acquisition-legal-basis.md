# Retailer data acquisition: legal basis and launch gate

**Research date:** 2026-08-26  
**Question:** May Babyboel replace mandatory pre-launch Dutch-counsel approval with internal research and operational safeguards?

## Decision

**Yes, but only for genuinely authorized sources.** Replace the blanket counsel condition with a source-by-source rights gate:

- Babyboel may launch a retailer from an approved affiliate feed/API or a licensed feed where the governing terms expressly cover Babyboel's channel and use. On current public evidence, **bol.com, Wehkamp and Plein are plausible launch sources after account/campaign approval, archival of the then-current private terms, and a field/retention review**. Bol provides an affiliate Marketing Catalog API and product feed; Wehkamp documents Partnerize feeds; Plein directs approved publishers to Daisycon campaign materials ([bol API](https://api.bol.com/marketing/docs/catalog-api/index.html), [bol feed](https://api.bol.com/marketing/docs/product-feed/index.html), [Wehkamp guide](https://images.wehkamp.nl/raw/Wehkamp-affiliates-startersgids), [Plein affiliate page](https://www.plein.nl/affiliate/)).
- **Written permission is required** before public activation of Albert Heijn, Etos, Trekpleister, Kruidvat, Babydrogist or OnlineLuiers. Babydrogist has a public Awin merchant profile, but network availability or affiliate acceptance alone does not establish permission to ingest, retain and republish its catalog fields.
- **Jumbo remains disabled**: its terms expressly prohibit tools that take website/app information or spider, scrape or otherwise improperly search it ([Jumbo terms](https://jumbo.com/service/algemene-voorwaarden)). **Blokker remains disabled** until a dependable current webshop and a current data route exist; its own FAQ says a new webshop is still being developed ([Blokker FAQ](https://www.blokker.nl/nl/veelgestelde-vragen/categorie/algemeen/)).
- Dutch counsel becomes **trigger-based, not a universal launch prerequisite**. Counsel is required for a proposed public-page scraper despite a prohibition/reservation, an uncertain contract or database-right position, technical-control avoidance, a complaint or cease-and-desist, personal-data collection beyond incidental security logs, unlicensed images/logos, or a materially new metasearch/history-republication model.

This preserves the earlier decisions: source-by-source rights are a launch condition; authorized feeds/APIs are preferred; technical controls are never bypassed; all eleven adapters may remain in implementation scope, but public launch needs rights and reliability gates and at least two independent active retailers.

## Direct answer to the hypothesis

A retailer's statement that “prices may not be scraped” **does not automatically turn every observation of a publicly visible price into statutory infringement or computer misuse**. A price, pack count or availability fact is ordinarily information, while copyright protects original expression and, for a database, original selection or arrangement—not facts as such ([Database Directive, Articles 3 and 7](https://eur-lex.europa.eu/eli/dir/1996/9/oj/eng); [Football Dataco, C-604/10](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62010CJ0604)). A public, unauthenticated GET request also differs materially from entering a protected system.

It does **not** follow that public prices are “free to scrape and republish.” The notice can still:

1. become a contractual restriction if terms were validly incorporated and accepted;
2. reserve the commercial text-and-data-mining exception where the reservation is appropriate and machine-readable;
3. accompany enforceable database rights against substantial, or repeated and systematic insubstantial, extraction/re-utilisation;
4. prove knowledge and objection in a Dutch unlawful-act claim;
5. make later evasion of blocks, authentication, CAPTCHAs or rate limits materially riskier; and
6. breach affiliate/campaign terms or end a commercial relationship even if no IP right was infringed.

The uncertain questions are fact-specific: whether a protected database exists; whether Babyboel takes a substantial part or cumulatively reconstructs one; whether its processing is “text and data mining”; whether a robots/terms signal is an effective Article 4 reservation; whether browsewrap formed a contract; and whether the manner, frequency and competitive effect are independently unlawful. Those are counsel triggers, not assumptions to code around.

## Keep five permissions separate

1. **Lawful collection.** Public accessibility lowers access-control risk but does not answer contract, IP, tort or downstream-use questions.
2. **Contractual permission.** A feed/API account, campaign approval and its governing terms define the authorized channel. Affiliate acceptance alone is not a catalog licence.
3. **Copyright/database reuse.** Facts may be unprotected while copied descriptions, images, creative arrangement or a protected database remain restricted.
4. **Technical access.** A legally arguable reuse does not authorize bypassing a block, account boundary, CAPTCHA or other control.
5. **Commercial-program compliance.** Approved channels, supplied links/assets, freshness, deletion, attribution and disclosure rules apply independently.

## Applicable Dutch/EU rules

### Facts, expression and databases

- Directive 96/9/EC gives database copyright only where selection or arrangement is the author's own intellectual creation; the contents retain their separate rights. Its sui generis right requires substantial investment in **obtaining, verifying or presenting** contents and can prohibit extraction or re-utilisation of all or a substantial part ([Articles 3 and 7](https://eur-lex.europa.eu/eli/dir/1996/9/oj/eng)). In *British Horseracing Board*, the Court distinguished investment in obtaining existing data from investment in creating the data and explained quantitative/qualitative substantiality; repeated acts are caught where their cumulative effect reconstructs or makes available all or a substantial part and seriously prejudices investment ([C-203/02](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62002CJ0203)).
- The Dutch Databankenwet mirrors this: Article 2 covers substantial extraction/reuse and repeated and systematic insubstantial taking that conflicts with normal exploitation or unjustifiably harms the maker; Article 3 protects a lawful user's use of insubstantial parts, subject to those limits ([Databankenwet](https://wetten.overheid.nl/BWBR0010591/)).
- “Extraction” is not limited to copying files. Individually consulting entries and transferring selected contents to another medium can qualify (*Directmedia*, [C-304/07](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62007CJ0304)). Conversely, the existence, investment and substantiality requirements still must be proved.
- A dedicated metasearch engine that translated user queries into a protected source database and offered access to all/substantially all contents by another route was re-utilisation in *Innoweb* ([C-202/12](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62012CJ0202)). In *CV-Online*, copying/indexing all or a substantial part of a freely accessible job database and making it searchable could be prohibited where it risks recoupment of the protected investment; the national court had to verify that economic condition ([C-762/19](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62019CJ0762)). Neither judgment makes every comparison site unlawful; both warn against rebuilding or functionally substituting for a protected source database.
- Babyboel should therefore store only necessary factual offer fields. Retailer prose, reviews, page layout and product photographs may be copyrighted. A factual price's lack of copyright does not defeat a database-right claim over systematic catalog extraction.

### Commercial text and data mining

DSM Directive 2019/790 Article 4 requires an exception for reproductions and extractions made for text and data mining of lawfully accessed material, but only where rights have not been expressly reserved. For publicly online content, recital 18 identifies machine-readable means, including metadata and website/service terms, as the appropriate route; copies may be kept only as long as necessary for the mining purpose ([Directive 2019/790, Article 4 and recital 18](https://eur-lex.europa.eu/eli/dir/2019/790/oj/eng/)).

The Netherlands implemented this in Auteurswet Article 15o and Databankenwet Article 4a(b): commercial TDM requires lawful access and no express appropriate reservation, such as machine-readable means for online material; TDM copies may be retained only as needed ([Auteurswet](https://wetten.overheid.nl/BWBR0001886/), [Databankenwet](https://wetten.overheid.nl/BWBR0010591/)).

Operational implications:

- Article 4 is an exception to copyright/database rights, not a new right over bare facts and not a general defence to contract, tort or computer misuse.
- A robots rule is technically a crawler instruction. It is not, by itself, proof of contract formation or database ownership. A clear machine-readable rights reservation can nevertheless be relevant to Article 4 and a generic `Disallow` is evidence that automated access is unwanted; whether a particular syntax sufficiently reserves the particular protected use remains fact-sensitive.
- If terms or machine-readable instructions expressly reserve scraping/TDM, Babyboel must not rely on Article 4 internally. Use an authorized route or escalate.

### Contract and “no scraping” terms

A contract requires offer and acceptance. Once general terms are incorporated, Dutch BW 6:232 can bind a party that did not read them; Articles 6:233–234 address unreasonable terms and a reasonable, storable opportunity to review them ([BW 6, Articles 232–234](https://wetten.overheid.nl/BWBR0005289/)).

*Ryanair v PR Aviation* establishes two narrower points:

- the Database Directive does not prevent contractual restrictions on use of a database that qualifies for neither database copyright nor the sui generis right, without prejudice to national contract law ([C-30/14](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A62014CJ0030));
- after remand, the Hague Court of Appeal found no acceptance of Ryanair's historical browsewrap under the applicable Irish law, and the Dutch Supreme Court rejected the later appeal without a substantive Article 81 explanation ([Gerechtshof Den Haag, ECLI:NL:GHDHA:2018:61](https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:GHDHA:2018:61), [Hoge Raad, ECLI:NL:HR:2019:1445](https://uitspraken.rechtspraak.nl/details?id=ECLI%3ANL%3AHR%3A2019%3A1445)).

That litigation is not a holding that Dutch browsewrap never binds. Clickwrap/account/API acceptance is substantially stronger; a footer link plus passive browsing is fact-dependent. Even where formation is uncertain, an explicit no-scraping clause is notice of objection and makes an unlicensed launch commercially fragile.

### Unlawful act, access controls and identity

Dutch BW 6:162 imposes liability for attributable infringement of a right, breach of a statutory duty, or conduct contrary to unwritten standards of proper social conduct that causes loss ([BW 6:162](https://wetten.overheid.nl/BWBR0005289/2017-09-01/0/Boek6/Titeldeel3/Afdeling1/Artikel162/afdrukken)). The Netherlands has no blanket rule that competitive collection of public facts is tortious. Risk rises with source substitution, systematic free-riding on protected investment, misleading presentation, excessive load, continued access after objection, or evasion of controls; *Innoweb* and *CV-Online* show why a near-substitute metasearch product is materially riskier than a narrow licensed offer feed.

Computer misuse is separate. Wetboek van Strafrecht Article 138ab addresses intentional and unlawful intrusion into an automated work ([Article 138ab](https://wetten.overheid.nl/BWBR0001854/)). Merely fetching an ordinary public page is not equivalent to bypassing access control, but Babyboel must never:

- use stolen/shared credentials or access authenticated/customer-only prices;
- solve or outsource CAPTCHAs, rotate IPs/proxies to defeat a block, or continue after an explicit technical denial;
- evade rate limits, forge authorization tokens, probe private/mobile endpoints, or disguise identity to regain denied access.

Those acts can change both civil and criminal analysis. A block, `401/403/429`, CAPTCHA, cease-and-desist or source-specific bot challenge is a hard stop, not an engineering problem.

### Marks, images, personal data and consumer presentation

- EU trade-mark law permits necessary referential use to identify goods/services only in accordance with honest commercial practices ([Regulation 2017/1001, Article 14](https://eur-lex.europa.eu/eli/reg/2017/1001/oj/eng)). Use retailer names in plain text, do not imply endorsement, and use logos or product images only where the feed/campaign expressly licenses them.
- GDPR is not engaged by a non-personal price fact alone. It applies if collection includes identifiable reviewers, sellers/sole traders, account data, device identifiers or logs that identify people; IP addresses can be personal data, and GDPR Articles 5 and 6 then require minimisation, retention discipline and a lawful basis ([GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [Dutch DPA](https://autoriteitpersoonsgegevens.nl/themas/basis-avg/privacy-en-persoonsgegevens/wat-zijn-persoonsgegevens)). Exclude reviews and user/seller profiles; keep crawler security logs separately and briefly.
- Comparative advertising may compare price if the comparison is objective, material, relevant, verifiable, representative and not misleading ([Directive 2006/114, Article 4](https://eur-lex.europa.eu/eli/dir/2006/114/oj/eng)). Show observed time, pack size, unit-price method, availability, shipping/subscription/member conditions and coverage limits.
- Commercial intent and paid ranking must be clear. The UCPD prohibits misleading omissions and undisclosed advertorial/paid ranking; ACM says advertising and paid results must be recognisable ([Directive 2005/29](https://eur-lex.europa.eu/eli/dir/2005/29/oj/eng), [ACM online-consumer guidance](https://www.acm.nl/system/files/documents/leidraad-bescherming-online-consument-2024.pdf), [ACM paid-ranking notice](https://www.acm.nl/nl/publicaties/acm-ziet-risicos-van-betaald-ranken-voor-consumenten-en-concurrentie)). Disclose affiliate compensation next to the comparison context and explain ranking parameters; compensation must not silently determine “cheapest” or “best.”

## Luieraanbiedingen.net: evidence, not a legality precedent

### Observed first-party evidence

- The site says it compares daily offers, price, supply and quality, calculates price per diaper, and currently displays thousands of offers from dozens of shops ([home page](https://www.luieraanbiedingen.net/), [shop index](https://www.luieraanbiedingen.net/winkel/)).
- Its footer discloses that it may receive compensation when a user clicks through or buys. Its applet page offers live, price-per-unit-sorted offers to family/baby publishers and says those publishers can generate revenue ([privacy/footer](https://www.luieraanbiedingen.net/privacyverklaring/), [applet](https://www.luieraanbiedingen.net/applet-gebruiken/)).
- The privacy page and contact page identify **We Compare B.V.**, Spoetnik 40, 3824 MG Amersfoort; the privacy page describes tracking cookies and cross-site browsing ([privacy](https://www.luieraanbiedingen.net/privacyverklaring/), [contact](https://www.luieraanbiedingen.net/contact/)).
- No public general-terms page was located in the site's visible legal/footer links. Its `robots.txt` currently allows general search indexing but expressly reserves AI-training rights under DSM Article 4 and blocks named AI crawlers; it also blocks `/wp-admin/` ([robots.txt](https://www.luieraanbiedingen.net/robots.txt)).
- Public pages expose retailer-specific counts and “Bekijk” outbound actions. The accessible first-party pages disclose possible affiliate compensation, but the rendered evidence reviewed did not reliably expose each redirect chain or the private retailer/network agreements.

### What may explain its operation

The following are **plausible models, not findings about its contracts**:

1. authorized affiliate-network product feeds for participating retailers;
2. retailer APIs or direct licensed feeds;
3. bilateral permission or allowlisting;
4. manually entered flyer/public-page observations;
5. narrow collection of public factual fields under a legal-risk position; or
6. a mixture that differs by retailer.

The applet, compensation disclosure, high offer counts and frequent updates are consistent with feed/affiliate use, but do not prove that every retailer authorized data ingestion, history retention, images or republishing. The site's existence, longevity and visibility prove only that it operates—not that its sourcing model is lawful or transferable to Babyboel.

Other Dutch comparison services can operate under the same range of models: retailer/network feeds, direct licences, merchant submissions, their own independently gathered facts, or a bounded public-data legal position. *Innoweb* itself arose from the Dutch GasPedaal metasearch service and shows that “comparison site” is not one legal category: the decisive facts included real-time translation into source search forms, access to all/substantially all of a protected database by another route, and source-substitution risk. The presence of GasPedaal or any other comparison service therefore establishes neither its current sourcing contracts nor a general right for Babyboel to copy the same retailers.

## Source-by-source rights and risk register

“Safe fields/assets” below are conditional on the stated authorized route and the governing private terms. No row treats affiliate acceptance alone as permission.

| Source | Observable authorized route / restrictions | Safe fields/assets and retention | Recommendation / evidence that changes it |
|---|---|---|---|
| **Albert Heijn** | No public publisher feed/API was established. Current `robots.txt` publishes product sitemaps and allows some routes but disallows many product-query/data routes; that is crawl guidance, not a licence ([robots](https://www.ah.nl/robots.txt)). AH terms reserve website/app content for personal use and restrict unpermitted reproduction ([current AH terms PDF](https://static.ah.nl/binaries/ah/content/assets/ah-nl/core/legal/algemene-voorwaarden/alg-vw-b2c-ah-nl-2026-04-08-iv1036830.11036921.1.pdf)). | None for production absent permission. A permission letter should name price, EAN/SKU, pack count, availability, URL, observation time, history period, frequency and whether images/logos are licensed. | **Written permission/allowlisting; otherwise disabled.** Change on a current AH publisher API/feed licence or signed permission covering Babyboel. |
| **Etos** | No official publisher program/feed located. Etos asserts rights in logos, software, text and images and says publication/reproduction/editing needs prior express permission except personal use ([Etos disclaimer](https://werk.etos.nl/Disclaimer)). | Narrow factual fields only if expressly permitted; no descriptions, images or logos by inference. Retention/history must be stated. | **Written permission; otherwise disabled.** Change on a first-party feed/API agreement or signed scope. |
| **Plein** | Plein officially runs an affiliate program through Daisycon; campaign conditions and materials are available after subscription ([Plein](https://www.plein.nl/affiliate/)). Daisycon requires advertiser approval of the specific media before campaign promotion or feed use ([publisher terms](https://daisycon.com/en/general-terms-and-conditions-publishers/), [feed guide](https://daisycon.com/en/developers/productfeeds/retrieving-specific-campaign/)). | Only campaign-feed fields/materials and approved links. Refresh at least at the campaign/feed cadence; purge disabled/withdrawn offers and on termination; retain history only if campaign terms allow it. | **Launch candidate after Babyboel media approval and archived Plein campaign terms.** Disable if no feed is supplied or comparison/history use is excluded. |
| **Trekpleister** | No public publisher feed/API located. Public webshop terms are consumer-sale terms, not a reuse licence ([terms](https://www.trekpleister.nl/voorwaardenwebshop)). | None for production absent permission; request the same narrow factual scope as AH. Do not use assets without a grant. | **Written permission/allowlisting; otherwise disabled.** Change on a current feed/API or signed permission. |
| **Jumbo** | Terms expressly prohibit tools aimed at taking accessible information and robot/spider/scrape or other improper search ([Jumbo terms](https://jumbo.com/service/algemene-voorwaarden)). `robots.txt` permits some ordinary product pagination but does not override the terms ([robots](https://www.jumbo.com/robots.txt)). | None through public-page automation. A direct licensed feed could define permitted fields, cadence and retention. | **Disabled.** Change only on written Jumbo permission or a licensed feed/API expressly covering comparison and history. Counsel reviews any proposed contrary public-page theory. |
| **Kruidvat** | No publisher feed/API located. Kruidvat says its site/components may not be published, copied or stored without express written permission except personal non-commercial use ([account/site terms](https://www.kruidvat.nl/voorwaardenaccountregistratie)). Its marketplace is a seller program, not publisher permission ([partner terms](https://www.kruidvat.nl/voorwaardenkruidvatpartners)). | None for production absent permission; plain factual fields only under written scope. No marketplace seller data, images or logos unless granted. | **Written permission/allowlisting; otherwise disabled.** Change on signed permission or a publisher feed/API. |
| **bol.com** | Marketing Catalog API is offered to registered affiliates; the product feed is intended to retrieve the current catalog and place it on an affiliate website ([API](https://api.bol.com/marketing/docs/catalog-api/index.html), [feed](https://api.bol.com/marketing/docs/product-feed/index.html)). Access needs an affiliate account and, for the feed, credentials/IP allowlisting ([access](https://api.bol.com/marketing/docs/product-feed/access-product-feed.html)). | API docs expose names, descriptions, specifications, images, prices and delivery data, subject to terms ([endpoints](https://api.bol.com/marketing/docs/catalog-api/api-documentation.html)). Obey `cache-control`; offer endpoints may be `no-cache`. Feed refreshes every two hours and removes unavailable products ([caching](https://api.bol.com/marketing/docs/catalog-api/conventions.html)). Historical storage needs confirmation in governing terms. | **Strongest launch candidate after explicit affiliate/API approval and terms archive.** No public-page scraping. Disable/purge on revocation; escalate if history or image rights are unclear. |
| **Babydrogist** | Awin's public merchant profile lists `Babydrogist NL - FamilyBlend` (advertiser 17201), but public visibility does not prove Babyboel approval, feed availability or data-reuse scope ([Awin profile](https://ui.awin.com/merchant-profile/17201?setLocale=en_GB)). | Only fields/materials delivered to an approved Babyboel publisher account and expressly allowed by private program terms; otherwise none. Follow feed withdrawal and termination rules; no assumed historical licence. | **Written campaign approval plus explicit feed/data scope required; otherwise disabled.** Change on archived private terms clearly authorizing comparison ingestion and retention. |
| **Wehkamp** | Official guide documents Partnerize campaign approval, links, banners and downloadable product feeds ([Wehkamp guide](https://images.wehkamp.nl/raw/Wehkamp-affiliates-startersgids)). Governing campaign terms are in the approved account. | Supplied feed fields/materials only. Refresh/remove at campaign cadence, stop on termination, and retain price history only if the campaign terms permit it. | **Launch candidate after Wehkamp NL approval and private-term review.** Disable if Babyboel/comparison use or required retention is excluded. |
| **Blokker** | Historical TradeTracker evidence does not establish a current program for Blokker New B.V. Current first-party pages describe the webshop as future/in development ([FAQ](https://www.blokker.nl/nl/veelgestelde-vragen/categorie/algemeen/), [privacy/company identity](https://www.blokker.nl/nl/pages/privacy-en-cookieverklaring/)). | None until a reliable current catalog and current entity-specific licence exist. Historic assets/terms must not be reused. | **Disabled for rights and reliability.** Change on a live dependable webshop plus current Blokker New B.V./network feed approval and terms. |
| **OnlineLuiers** | First-party pages identify OnlineLuiers.com as De Haan E-Commerce; no official publisher program/feed was established ([about](https://www.onlineluiers.com/service/about/), [terms](https://www.onlineluiers.com/algemene-voorwaarden/)). Consumer shop terms and ordinary links do not authorize ingestion. | None for production absent permission. Seek narrow factual fields, frequency, history, deletion and asset rights in writing. | **Written permission; otherwise disabled.** Change on a direct licensed feed/API or signed permission. |

## Strict operational safe harbor

A source may be activated without bespoke Dutch-counsel review only when every item is true:

1. The source is an official retailer/network feed or API, not scraped public HTML.
2. Babyboel's exact website/channel has been approved; the current retailer, network and API terms are archived with date/version.
3. The terms permit product comparison/promotion and the actual ingestion method; affiliate acceptance is not treated as enough.
4. An allowlist records permitted fields. Default is retailer, product identifier/EAN/SKU, factual product/variant name, pack count, current price including VAT, availability, delivery/member conditions, destination URL and `observed_at`.
5. Descriptions, reviews, retailer logos and product images are excluded unless supplied and expressly licensed for the approved use.
6. Cache, refresh, deletion, offer-expiry and termination requirements are implemented. No history is kept beyond the express licence; ambiguous history rights are escalated.
7. Requests identify Babyboel honestly, use documented endpoints, stay below stated limits and back off on `429`. No CAPTCHA solving, proxy rotation, fingerprint disguise, private endpoint discovery or access after denial.
8. `robots.txt`, terms, API docs and campaign conditions are checked and diffed before activation and at least monthly. A new prohibition/reservation automatically pauses ingestion.
9. Raw pages/responses are ephemeral unless the licence permits archival. Audit records keep source URL, terms version, timestamps and normalized facts—not copied page content.
10. Collection excludes reviews, account/customer data and other personal data. Security logs are minimised, access-controlled and subject to a short documented retention period.
11. The UI shows observation time, unit-price calculation, pack/availability/shipping/member conditions, comparison coverage, ranking method and clear affiliate disclosure. Paid status never silently changes factual price ranking.
12. A kill switch can stop and unpublish one source immediately. Termination/revocation purges fields and assets as required while preserving only minimal compliance evidence.

## Mandatory escalation triggers

Pause the source and obtain Dutch counsel or written retailer clarification if any of the following occurs:

- proposed public-page automation where terms, robots or metadata prohibit/reserve scraping or TDM;
- uncertainty whether a feed licence covers price history, republishing, images, logos, derived unit prices or Babyboel's channel;
- collection approaching all/substantially all of a catalog, repeated systematic extraction, source-query translation, or a product that substitutes for the source search/database;
- login, session token, location/account-specific price, CAPTCHA, block, `401/403/429`, IP rotation, anti-bot challenge or request to conceal crawler identity;
- complaint, takedown, cease-and-desist, changed terms, revoked campaign approval or anomalous load;
- personal data beyond incidental security logs, or linkage of click/user data across sources;
- rankings influenced by compensation, unclear affiliate disclosure, unsupported “lowest/best” claims, or inability to evidence price freshness and comparability;
- any source proposed as the second independent launch retailer where its licence or reliability is not documented.

## Evidence limits / not legal advice

This is a product-risk decision record, not legal advice or a legal opinion. Public sources cannot reveal private campaign terms, bilateral licences, technical arrangements, enforcement history or each retailer database's protected investment. Search-result absence is not proof that no private feed exists. Robots and public terms can change without notice; retailer pages may be geolocated or account-specific.

The conclusions are deliberately conservative: they permit launch without bespoke counsel only inside documented licences and make ambiguous scraping a counsel trigger. Before activation, archive the actual approved campaign/API terms and have the responsible operator sign the rights register. Re-run the review whenever the source, fields, retention, access method, ranking or monetisation changes.
