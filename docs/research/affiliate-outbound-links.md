# Affiliate attribution and outbound-link research

Research note for GitHub issue 19, “Define affiliate attribution and outbound-link policy.”

**Access/retrieval date for every source in this note:** 2026-08-26.

## Scope and evidence standard

This note records facts from public primary sources only: retailer pages, affiliate-network documentation and terms, Dutch government/regulator materials, EU legislation, EDPB guidance, and CJEU material. Search-result absence is not evidence that a retailer has no affiliate arrangement. Where no public primary source established a program or a rule, the result is marked **unknown**.

The repository had no existing research/notes convention. This note therefore uses the requested `docs/research` location.

## Facts versus product decisions

The following are **facts or bounded interpretations of cited text**, not a Babyboel policy. They do not decide:

- which retailers Babyboel should monetize;
- whether rankings may use commercial status;
- whether Babyboel should use direct links, network links, or a Babyboel redirect;
- what disclosure wording or placement Babyboel should adopt;
- whether Babyboel should collect click analytics;
- whether a particular low-impact affiliate implementation qualifies for the Dutch consent exception.

Those are product, contractual, and in some cases legal decisions. In particular, eligibility for the Dutch low-privacy-impact affiliate exception depends on the actual data flow, purposes, retention, anonymisation, and private campaign terms.

## Retailers, in launch priority order

### 1. Wehkamp

**Program/network availability.** Wehkamp publishes an official [affiliate starter guide](https://images.wehkamp.nl/raw/Wehkamp-affiliates-startersgids) for its `Wehkamp NL` campaign on Partnerize. Participation requires campaign approval and acceptance of the campaign terms in the Partnerize console.

**Product/deep links.** Supported. The guide says the standard tracking link lands on the homepage and that a publisher can enter a deeper Wehkamp URL, after which Partnerize generates the changed affiliate link. The guide also describes banners, text material, and feeds.

**Link parameters.** The guide identifies the publisher’s unique affiliate ID as `camref`, says Partnerize uses it to attribute clicks, sales, and commissions, and shows a form such as:

```text
http://prf.hn/click/camref:<publisher-camref>/adref:<publisher-reference>/destination:<wehkamp-url>
```

The guide describes the publisher reference as optional. Current production link domains and any mandatory campaign-specific values must be taken from the approved Partnerize account, not copied from the guide’s old HTTP example.

**Disclosure/consent terms.** The public Wehkamp guide does not prescribe consumer-facing wording. Partnerize’s official [publisher terms, clause 7.2](https://partnerize.com/wp-content/uploads/2024/05/20240503-Partnerize-Publisher-Terms-and-Conditions-1.7.-UK-Entity.pdf) say Partnerize processes user personal data and uses tracking code and/or cookies for performance tracking and transaction attribution; the publisher must make necessary disclosures and obtain necessary consents concerning code/cookies, IP address and browser details, click and purchase processing, and disclosures to advertisers and Partnerize. Which Partnerize contracting entity and version governs Wehkamp is **unknown until account approval/private terms are reviewed**.

**Attribution mechanism.** The Wehkamp guide confirms a Partnerize tracking redirect and `camref`-based click/sale attribution. Partnerize documents cookie/tracking-code processing, and separately documents [server-to-server attribution](https://partnerize.com/resources/blog/ap-why-the-benefits-of-api-tracking-in-the-partner-channel) using a `clickref` passed from click redirect to transaction reporting. The exact Wehkamp implementation—cookie type and duration, pixel versus server-to-server conversion reporting, and attribution window—is **not public**.

**Server-side redirects/link cloaking.** No public Wehkamp campaign text expressly addresses a publisher-operated first-party redirect. Partnerize’s general terms prohibit misleading or forced clicks and mimicking clicks that store attribution cookies. Those provisions do **not** by themselves establish that every transparent, same-site server redirect is prohibited. Partnerize itself uses tracking redirects and offers advertiser-brand-domain [custom tracking](https://go.partnerize.com/custom-tracking-partners). Whether Babyboel may put its own redirect in front of the supplied link is **unknown and requires the governing Wehkamp campaign terms or written approval**.

### 2. Plein

**Program/network availability.** Plein’s official [affiliate page](https://www.plein.nl/affiliate/) states that its affiliate program runs through Daisycon and that publishers can earn compensation from traffic or sales through affiliate links. It directs applicants to Daisycon for campaign conditions, links, and materials.

**Product/deep links.** Daisycon supports deep links generally, but says publishers must verify that deep linking is enabled for the particular campaign. Its [deep-link documentation](https://faq-publisher.daisycon.com/hc/en-us/articles/204787242-Deeplinking-what-is-it-and-how-to-use-it) can generate links to product/category pages. Public Plein material does not confirm that the Plein NL campaign has deep linking enabled, so campaign-specific support is **unknown pending the logged-in campaign description**.

**Link parameters.** Daisycon’s official [link-structure documentation](https://faq-publisher.daisycon.com/hc/en-us/articles/204787042-How-is-a-Daisycon-affiliate-deep-link-structured) gives:

```text
https://<tracking-domain>/c/?si=<campaign-id>&wi=<media-id>&li=<link-id>&ws=<sub-id>&dl=<encoded-path>
```

`si` is the campaign/submerchant ID, `wi` the approved media/website ID, `li` the link ID, optional `ws` the publisher sub-ID, and `dl` the URL-encoded path after the advertiser domain. Plein-specific IDs and tracking domain are private account values.

**Disclosure/consent terms.** Daisycon’s [publisher terms](https://daisycon.com/en/general-terms-and-conditions-publishers/) require promotion only through an advertiser-approved channel and compliance with campaign conditions and applicable advertising/privacy law. Its [social-media guidance](https://faq-publisher.daisycon.com/hc/en-us/articles/360019972978-Guidelines-Social-Media-Influencers-Affiliate-Marketing) says promotional posts should clearly indicate that they contain an affiliate link and are promotional. Plein-specific wording is **not public**.

**Attribution mechanism.** Daisycon’s official [cookie statement](https://daisycon.com/en/legal-information/cookies/) lists session and affiliate cookies, including `PHPSESSID`, `DCI`, `PDC`, and campaign-scoped `ci_{program_ID}`, `ca_{program_ID}`, and `si_{program_ID}`. Listed data include a random identifier, date/time, campaign ID, cart-lock value, link ID, website ID, and sub-ID. Daisycon also describes advertiser conversion pixels and last-click/network deduplication in its [advertiser documentation](https://faq-advertiser.daisycon.com/hc/en-us/articles/208742425-Network-deduplication-with-last-click-logic-LCC). The Plein-specific cookie duration, pixel/server-side configuration, and attribution rule are **unknown**.

Daisycon’s cookie statement asserts that low-impact affiliate cookies are exempt under Dutch law and that it relies on legitimate interests for its service processing. That is a network legal position, not regulator guidance; the Dutch statutory conditions are discussed below.

**Server-side redirects/link cloaking.** Daisycon’s terms prohibit intentionally masking/cloaking links **to deceive**, unsolicited cookie dropping, and any non-transparent traffic source or generation method. Daisycon itself supplies redirecting tracking links and an approved [automatic link replacer](https://faq-publisher.daisycon.com/hc/en-us/articles/360008840657-What-is-Daisycon-s-automatic-linkreplacer-and-how-to-use-it). Therefore the public text prohibits deceptive cloaking, not all redirects. Permission for a Babyboel-operated redirect remains **unknown under Plein’s private campaign conditions**.

### 3. bol.com

**Program/network availability.** Bol operates its own public [Affiliate Program](https://affiliate.bol.com/nl/algemene-voorwaarden/). An applicant must be accepted, and each affiliate channel receives a unique `Site_ID`. Section 3.9 limits partner links to channels listed in the affiliate account.

**Product/deep links.** Supported. Bol’s [text-link guide](https://affiliate.bol.com/nl/handleiding/handleiding-tekstlink/) says a text link may point to any bol page, including a product or action page. Its product-feed guide explains how ordinary product URLs become tracked links.

**Link parameters.** Bol’s current [tracking URL guide](https://affiliate.bol.com/nl/handleiding/tracking-url/) specifies the base endpoint and core values:

```text
https://partner.bol.com/click/click?p=1&t=url&s=<SiteId>&url=<ProductURL>&f=<medium>&subid=<SubID>&name=<Name>
```

`s` is the channel-specific `SiteId`; `url` is the destination; `f` identifies the promotional medium (`TXL` for a text link and `PF` for product-feed links); `subid` and `name` are shown as additional reporting values. The guide says `tracking.bol.com` and `partnerprogramma.bol.com` are deprecated. Bol’s product-feed guide says a successful redirect produces a destination URL containing `Referrer=ADVNLPP…<SiteID>`.

**Disclosure terms.** Bol’s [social-media rules](https://affiliate.bol.com/nl/social-media-richtlijnen/) require a clear, concise, unambiguous statement that the publisher has a relevant relationship with bol and receives compensation for commercial communication. The rules also require compliance with the Media Act, the Social Media & Influencer Marketing Advertising Code, and other applicable law. The public terms do not supply one universal disclosure sentence for ordinary web comparison pages.

**Attribution mechanism.** Sections 6.2–6.3 of the affiliate terms state that bol measures sales with a **first-party cookie**, generally lasting five days, and applies **Last Cookie Counts**. Bol’s [commission/tracking guide](https://affiliate.bol.com/nl/handleiding/commissiemodel-affiliate-programma/) describes two concurrent methods: it stores the referrer in a recognised visitor’s bol shopping cart and falls back to a first-party cookie when no cart referrer exists. It says attribution can survive a device change when the recognised cart mechanism applies.

**Server-side redirects/link cloaking.** Bol expressly permits shortening affiliate links in its [affiliate style guide](https://affiliate.bol.com/nl/handleiding/affiliate-stijlgids/). Its [misuse guidance](https://affiliate.bol.com/nl/handleiding/Vormen-van-misbruik/) prohibits cookie dropping and buttons that send users to bol without making that destination clear; suggested transparent labels include “Bekijk op bol,” “Koop op bol,” and “Ga naar bol.” The terms also prohibit partner links behind pop-ups, framing, interception of traffic, and unapproved channels. No public provision expressly approves or bans a transparent same-domain Babyboel server redirect. Because the channel-specific `Site_ID`, source transparency, and referrer integrity matter, that implementation requires **private-term confirmation or written approval**.

### 4. Babydrogist

**Program/network availability.** Awin’s official public [merchant profile](https://ui.awin.com/merchant-profile/17201?setLocale=en_GB) lists `Babydrogist NL - FamilyBlend`, advertiser ID `17201`, and offers publisher sign-up. It states a 30-day attribution/cookie period.

**Product/deep links.** Awin supports deep linking through [Link Builder](https://success.awin.com/articles/en_US/Knowledge/How-can-I-use-Link-Builder-to-create-Deep-Links), but warns that an advertiser may disable it. The public Babydrogist profile does not confirm its setting. Babydrogist product/deep-link support is therefore **unknown until tested in the joined program or confirmed in private terms**.

**Link parameters.** Awin’s [manual deep-link specification](https://success.awin.com/articles/en_US/Knowledge/What-is-deep-linking-and-why-should-I-use-this) gives:

```text
https://www.awin1.com/cread.php?awinmid=<advertiser-id>&awinaffid=<publisher-id>&clickref=<optional-ref>&ued=<encoded-destination>
```

For Babydrogist, the public advertiser ID is `17201`; `awinaffid` belongs to the approved publisher. Awin documents up to six optional `clickref` values and an `extr` parameter for the encoded source-page URL. Link Builder-generated values should govern over hand-built assumptions.

**Disclosure/consent terms.** The public Babydrogist profile and publicly visible terms do not prescribe a disclosure phrase. Awin says in its [GDPR/ePrivacy statement](https://www.awin.com/us/legal/gdpr-eprivacy-awin) that its publisher terms have required publishers to obtain cookie consent, including for Awin, and that transparency is required. Whether the Babydrogist program has extra private disclosure rules is **unknown**.

**Attribution mechanism.** The profile specifies 30 days. Awin’s [tracking explanation](https://help.awin.com/docs/understanding-affiliate-tracking) documents unique affiliate links followed by cookies or server-based storage, client-side tags/pixels, first-party cookies, and server-to-server conversion reporting. Its [allocation guide](https://success.awin.com/articles/en_US/Knowledge/how-are-transactions-tracked-and-correctly-allocated-to-publishers) says Awin advertisers use first-party cookies. The exact Babydrogist mix—redirect/cookie, MasterTag/pixel, and server-to-server—is **not public**.

**Server-side redirects/link cloaking.** Awin Link Builder can shorten links, and Awin operates network redirects and a “bounceless” option. No publicly visible Babydrogist term expressly addresses a publisher-operated redirect or cloaking. The governing Babydrogist/Awin terms must be checked privately. Deceptive destination hiding should not be inferred as permitted merely because shortening is available.

### 5. Onlineluiers

**Identity checked.** The official retailer is [OnlineLuiers.com](https://www.onlineluiers.com/), not an active `.nl` storefront in the located material; its [about page](https://www.onlineluiers.com/service/about/) identifies it as part of De Haan E-Commerce.

**Program/network availability.** **Unknown.** No public official retailer or official affiliate-network source located in this research established a current OnlineLuiers.com publisher program. This is not a finding that no private program exists.

**Product/deep links, parameters, disclosures, attribution, redirects/cloaking.** **Unknown.** These require a retailer response or private network/campaign terms. Ordinary non-affiliate product links are technically possible, but that fact says nothing about authorization for commission tracking.

### 6. Etos

**Program/network availability.** **Unknown.** No public official retailer/network source located established an Etos publisher affiliate program. Etos’s official [referral page](https://werk.etos.nl/referral) concerns employee recruitment, not product affiliates, and its [franchise page](https://www.etos.nl/over-etos/franchise/) concerns store franchising.

**Product/deep links, parameters, disclosures, attribution, redirects/cloaking.** **Unknown pending direct confirmation/private terms.**

### 7. Albert Heijn

**Program/network availability.** **Unknown.** No public official retailer/network source located established a consumer-product publisher affiliate program. [AH Media Services](https://www.ah.nl/mediaservices/adverteren/hulp) is an on-platform retail-media/CPC advertising offer for brands and suppliers, not evidence of an outbound publisher affiliate program. Albert Heijn’s [partnership page](https://www.ah.nl/klantenservice/over-albert-heijn/samenwerking-en-sponsoring?size=40) says it currently has no room for new national partnerships, but that statement does not definitively address affiliate programs.

**Product/deep links, parameters, disclosures, attribution, redirects/cloaking.** **Unknown pending direct confirmation/private terms.**

### 8. Trekpleister

**Program/network availability.** **Unknown.** No public official retailer/network source located established a Trekpleister publisher affiliate program. Official public pages cover the [consumer webshop](https://www.trekpleister.nl/onlinewinkelen), not affiliate participation.

**Product/deep links, parameters, disclosures, attribution, redirects/cloaking.** **Unknown pending direct confirmation/private terms.**

### 9. Kruidvat

**Program/network availability.** **Unknown for affiliate publishing.** Kruidvat publicly offers a [Marketplace](https://www.kruidvat.nl/marketplace), where third-party sellers list and fulfil products and pay commission on sold items. Kruidvat’s [partner-product explanation](https://www.kruidvat.nl/producten-verkooppartners) says consumers buy from the named external seller and that the product page labels the seller. This is a marketplace seller program, not evidence of an affiliate publisher program.

**Product/deep links, affiliate parameters, affiliate disclosures/attribution, redirects/cloaking.** **Unknown pending direct confirmation/private terms.** Marketplace links should preserve the displayed seller identity; the public marketplace material does not authorize affiliate tracking.

### 10. Jumbo

**Program/network availability.** **Unknown for affiliate publishing.** Jumbo publicly offers [Jumbo Retail Media](https://adverteren.jumbo.com/) and a [self-service advertising platform](https://www.jumbo.com/nieuws/jumbo-introduceert-self-service-platform-voor-adverteerders/) for supplier/brand sponsored products, display, and in-store media. Those are paid placements on Jumbo channels, not evidence of an outbound publisher affiliate program.

**Product/deep links, parameters, disclosures, attribution, redirects/cloaking.** **Unknown pending direct confirmation/private terms.**

### 11. Blokker

**Program/network availability.** **Current availability is unknown; a historical official relationship is public.** TradeTracker’s official [interview with Blokker.nl](https://tradetracker.com/nl/interview-blokker-125-jaar/) says Blokker had worked with TradeTracker for years and invites publishers to promote the campaign. It does not establish that the campaign remains active for Blokker New B.V. Blokker’s current official [general FAQ](https://www.blokker.nl/nl/veelgestelde-vragen/categorie/algemeen/) says it is working on a new webshop, while its [privacy statement](https://www.blokker.nl/nl/pages/privacy-en-cookieverklaring/) describes a future webshop. Historic program terms from the pre-2025 business cannot safely be assumed to govern the current entity.

**Product/deep links and parameters.** **Unknown for a current Blokker campaign.** Generic TradeTracker support for links or deep links does not prove that a specific Blokker campaign enables them.

**Attribution mechanism.** TradeTracker’s official [cookie explanation](https://tradetracker.com/gb/privacy-policy/how-we-use-cookies/) says following one of its affiliate links may set `__tdat*` or `__tgdat*` on `tradetracker.net`, recording the originating affiliate site, promotional material, and optional affiliate reference. Duration varies by instance up to 365 days. This describes the network, not Blokker’s historical or current campaign-specific duration or conversion implementation.

**Disclosure and server-side redirects/link cloaking.** No current Blokker-specific public wording was located. TradeTracker’s Netherlands [Code of Conduct](https://tradetracker.com/nl/code-of-conduct/) requires maximum transparency, prohibits hiding or misrepresenting click origin, and says traffic may originate only from the URL configured for the affiliate site. A Babyboel redirect that obscures origin or uses an unregistered source would conflict with that public network rule. Whether a transparent registered redirect is accepted by a current Blokker campaign remains **unknown pending current private terms/written approval**.

## Dutch and EU legal sources

This section states the legal source text and its direct implications, but is not legal advice.

### Commercial disclosure

- The EU Unfair Commercial Practices Directive, [Directive 2005/29/EC, Annex I point 11](https://eur-lex.europa.eu/eli/dir/2005/29/oj/eng), always treats as unfair the use of paid editorial content to promote a product without making the payment clear in the content or through consumer-identifiable images/sounds (“advertorial”).
- The Dutch ACM’s [2024 Leidraad Bescherming online consument](https://www.acm.nl/system/files/documents/leidraad-bescherming-online-consument-2024.pdf) says advertising must be recognisable; sponsored editorial content must be marked, and at the product it must state who pays and that the content is sponsored. The precise application to a page containing multiple monetized and unmonetized retailer offers needs layout-specific analysis.
- The Dutch government’s [social-media advertising guidance](https://ondernemersplein.overheid.nl/wetten-en-regels/reclameregels-voor-social-media-influencer-marketing/) expressly identifies an affiliate link as a relationship where the publisher is paid if users buy, and says the creator must clearly disclose that compensation. It also notes separate Media Act obligations for qualifying video uploaders.

These sources support a duty of clear commercial recognisability. They do not, by themselves, prescribe one universal label, exact placement, or whether every individual link needs repeated wording in every Babyboel layout. That implementation question remains a product/legal decision.

### Affiliate URL tracking is within ePrivacy’s technical scope

Article 5(3) of the [ePrivacy Directive 2002/58/EC](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32002L0058) covers storing information or gaining access to information stored on terminal equipment, subject to consent and stated exceptions.

The EDPB’s final [Guidelines 2/2023](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf), paragraphs 49–51, use affiliate marketing as the express example of tracking links:

- an identifier is appended to the destination URL so the retailer can identify the partner responsible for a sale;
- distribution of the tracked URL to the user’s terminal is storage, at least through browser caching;
- instructing the terminal to return the identifier and collecting it is “gaining access.”

The EDPB therefore places tracked affiliate URLs—not only cookies or pixels—inside Article 5(3)’s technical scope. The guidelines expressly do **not** decide whether consent or an exemption applies; that requires a case-by-case assessment under national implementation.

### Dutch low-impact affiliate exception

Article 11.7a(3)(b) of the Dutch Telecommunicatiewet, as enacted in [Staatsblad 2015, 100](https://zoek.officielebekendmakingen.nl/stb-2015-100.html), exempts storage/access used to obtain information about the quality or effectiveness of a delivered information-society service if it has no or only minor privacy consequences.

The official [explanatory memorandum, Kamerstuk 33902 nr. 3](https://zoek.officielebekendmakingen.nl/kst-33902-3.html), specifically says affiliate cookies can fall within that exception where they are used **only** to determine whether an advertisement led to a purchase and which affiliate should be paid, with no or negligible privacy effects. Cookie lifetime should be no longer than necessary for that purpose.

The government’s [answers, Kamerstuk 33902 nr. 6](https://zoek.officielebekendmakingen.nl/kst-33902-6.html), add that:

- the purpose is not mapping an individual’s buying behaviour, but only establishing that a visit to site A led to a purchase on site B;
- processing can be anonymised;
- anonymisation must be immediate and effective, excluding construction of a behavioural profile.

Accordingly, Dutch primary sources recognize a possible no-consent affiliate exception, but it is conditional, not categorical. Adding page-level click analytics, persistent user/sub IDs, cross-device matching, profiling, reuse for ranking/personalisation, or unnecessarily long retention may change the analysis. The EDPB’s later confirmation that tracked URLs themselves fall within Article 5(3) makes it important to assess the whole URL/cookie/pixel flow, not merely whether Babyboel sets a cookie.

### Ordinary retailer-set first-party attribution versus Babyboel tracking

These are distinct processing layers:

1. **Destination/network attribution.** A user intentionally follows a tracked link; the retailer/network receives the affiliate identifier and may set a first-party cookie, write a cart referrer, run a conversion pixel, or later send a server-to-server conversion. Bol publicly documents this model; other networks document variants. The retailer/network decides much of this downstream processing, but Babyboel’s act of distributing the tracked URL is itself within Article 5(3)’s technical scope under EDPB Guidelines 2/2023.
2. **Babyboel-operated measurement.** A Babyboel click endpoint, JavaScript listener, local storage/cookie, unique per-user link value, IP/user-agent log, or analytics event is a separate Babyboel-controlled collection/processing step. It requires its own purpose, minimisation, retention, security, transparency, and legal-basis assessment. The AP notes that [an IP address can be personal data](https://autoriteitpersoonsgegevens.nl/themas/basis-avg/privacy-en-persoonsgegevens/wat-zijn-persoonsgegevens), and GDPR [Articles 5, 6 and 13](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=celex%3A32016R0679) require lawful, fair, transparent, purpose-limited and minimised processing, a lawful basis, and information to the data subject.

A simple HTTP redirect is not legally invisible merely because it sets no cookie: ordinary server logs can process IP address, timestamp, requested product/retailer, referrer, and user agent. Conversely, the existence of a retailer’s destination-set first-party cookie does not prove that Babyboel itself has set or read that cookie.

### When consent is required

- The AP states that privacy-impacting [tracking cookies](https://autoriteitpersoonsgegevens.nl/themas/internet-slimme-apparaten/cookies/tracking-cookies) require consent that is free, specific, informed, unambiguous, and given by an active action; visitors must be able to refuse and withdraw.
- The CJEU’s [Planet49 judgment summary, Case C-673/17](https://curia.europa.eu/site/upload/docs/application/pdf/2019-10/cp190125en.pdf), says a pre-ticked box is insufficient and that users must be informed of cookie duration and third-party access.
- EDPB [Guidelines 05/2020](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf) say cookie walls do not provide freely given consent and scrolling/swiping is not an unambiguous affirmative action.
- Awin’s own [cookie-consent documentation](https://help.awin.com/docs/cookie-consent-settings) says its tracking cookies generally cannot be opted in by default because they are not strictly necessary, while allowing that specific reward/cashback implementations may qualify for an exception. A network position is not a substitute for the Dutch statutory assessment.

For Babyboel, the unresolved legal question is whether each actual retailer/network implementation stays within the narrow Dutch low-impact effectiveness exception. If it does not, consent must precede the relevant storage/access. Separately, any Babyboel processing of personal data needs an AVG basis even where article 11.7a consent is not required.

## Unresolved unknowns checklist

- [ ] Obtain and archive the current private campaign terms for Wehkamp, Plein, bol, and Babydrogist after approval.
- [ ] Confirm current contracting entity/network and program status for each active program.
- [ ] Confirm Wehkamp cookie/attribution window, conversion method, mandatory current link form, and own-redirect rule.
- [ ] Confirm Plein NL campaign ID, deep-link flag, cookie duration, last-click/deduplication rule, conversion method, and own-redirect rule.
- [ ] Confirm bol in writing whether a transparent Babyboel same-domain click redirect is permitted and whether it affects approved-channel/referrer validation.
- [ ] Confirm Babydrogist deep-link support, current 30-day rule, conversion method, disclosure terms, and redirect/cloaking restrictions.
- [ ] Ask OnlineLuiers.com, Etos, Albert Heijn, Trekpleister, Kruidvat, and Jumbo whether a public or invite-only publisher program exists; ask Blokker/TradeTracker whether the historical Blokker campaign applies to Blokker New B.V.
- [ ] For every approved program, record excluded product classes, especially regulated baby food and medicines.
- [ ] Obtain exact consumer-disclosure requirements and brand/button wording from each campaign.
- [ ] Document the complete click-to-conversion data flow: URL identifiers, redirects, cookies/local storage, cart/account matching, pixels/tags, server-to-server calls, recipients, purposes, and retention.
- [ ] Determine whether any identifier is user-specific, reused across retailers, exposed in logs/referrers, or used for profiling, ranking, personalisation, or cross-device matching.
- [ ] Decide only after legal review whether each implementation satisfies the Dutch no/low-impact affiliate exception; the public facts do not settle that conclusion.
- [ ] If Babyboel measures clicks, define and review its separate AVG purpose, legal basis, notice, minimisation, retention, security, and consent implications.
- [ ] Have counsel reconcile Dutch article 11.7a legislative history with EDPB Guidelines 2/2023 for the final tracked-URL architecture.
