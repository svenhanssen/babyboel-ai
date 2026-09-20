import {
  publicContactEmail,
  publicSiteName,
  publicSiteOrigin,
  publicRetailerCoverage,
  publicTrustUpdatedOn,
  type PublicCoverageStatus,
} from './trust-identity'

export interface TrustPageContent {
  slug: 'methode' | 'verdienmodel' | 'dekking' | 'privacy' | 'contact'
  eyebrow: string
  title: string
  introduction: string
  sections: Array<{
    title: string
    paragraphs: string[]
    links?: Array<{ href: string; label: string }>
  }>
  coverage?: boolean
}

export const trustPageLinks = [
  { href: '/methode', label: 'Methode' },
  { href: '/verdienmodel', label: 'Verdienmodel' },
  { href: '/dekking', label: 'Dekking' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
] as const

const coverageStatusLabel: Record<PublicCoverageStatus, string> = {
  actief: 'actief',
  'tijdelijk gepauzeerd': 'tijdelijk gepauzeerd',
  'nog niet actief': 'nog niet actief',
}

export const trustPages: Record<TrustPageContent['slug'], TrustPageContent> = {
  methode: {
    slug: 'methode',
    eyebrow: 'Controleerbaar vergelijken',
    title: 'Zo vergelijkt Babyboel',
    introduction:
      'Babyboel vergelijkt luiers, luierbroekjes en billendoekjes in Nederland op exacte Products en Packages. We rangschikken op de laagste actuele universele stukprijs, niet op merkrelaties of commissie.',
    sections: [
      {
        title: 'Wat we vergelijken',
        paragraphs: [
          'Een Product is een exacte combinatie van merk, lijn of variant en genormaliseerde maat. Een Package is een verpakt aantal van dat Product. Een Listing is de retailerpagina van één verkoper. Een Offer is de prijs, beschikbaarheid en voorwaarden van die Listing.',
          'We nemen alleen landelijke, in-scope Offers mee. Restricted Offers met lidmaatschap, coupon of andere voorwaarden blijven zichtbaar, maar bepalen de hoofdvolgorde niet.',
        ],
      },
      {
        title: 'Rangschikking en berekening',
        paragraphs: [
          'De laagste universele stukprijs staat eerst. We rekenen met gehele centen en aantallen: te betalen bedrag gedeeld door het aantal stuks dat je daarvoor nodig hebt, inclusief een verplicht aantal verpakkingen.',
          'Verzending zit niet in de stukprijs. Bezorgkosten hangen af van je bestelling en kunnen extra zijn. Controleer altijd de uiteindelijke prijs, beschikbaarheid, levering en betaling bij de retailer.',
        ],
      },
      {
        title: 'Actualiteit',
        paragraphs: [
          'Een Offer is alleen actueel wanneer prijs, voorwaarden, beschikbaarheid en bestemming binnen 48 uur zijn bevestigd. We noemen prijzen nooit live.',
        ],
      },
      {
        title: 'Beperkingen en correcties',
        paragraphs: [
          'Babyboel is geen verkoper en dekt niet de hele Nederlandse markt. Zie je een fout in identiteit, prijs of voorwaarden? Meld die via contact, met de Product- en retailerpagina erbij.',
        ],
        links: [{ href: '/contact', label: 'Contact' }],
      },
    ],
  },
  verdienmodel: {
    slug: 'verdienmodel',
    eyebrow: 'Onafhankelijke productwaarheid',
    title: 'Hoe Babyboel geld kan verdienen',
    introduction:
      'Sommige retailerlinks kunnen commissie opleveren. Dat verandert nooit welke retailer of Offer wordt opgenomen, en ook niet de rangschikking.',
    sections: [
      {
        title: 'Directe bestemming',
        paragraphs: [
          'Je volgt een directe link naar de exacte Listing en verkoper, in hetzelfde tabblad. Als affiliate-toeschrijving is goedgekeurd, wijst de actie naar het goedgekeurde netwerkadres met diezelfde geverifieerde bestemming erin. Ontbreekt of faalt die configuratie, dan gebruik je dezelfde gewone Listing-bestemming. Er is geen tussenpagina of Babyboel-doorverwijsservice.',
        ],
      },
      {
        title: 'Geen bezoekersprofiel',
        paragraphs: [
          'Babyboel telt hoogstens cookieloos hoe vaak een Listing-actie is gekozen, per UTC-dag, retailer, Listing, plaatsing en of de actie een Affiliate link was. Dat is een ruwe richting, geen financieel record en geen bezoekersprofiel. Er is geen cookie banner nodig voor deze telling.',
        ],
      },
      {
        title: 'Geen verkoper',
        paragraphs: [
          `${publicSiteName} verkoopt geen Products. De retailer bepaalt de bestelling, levering, betaling en het retourbeleid.`,
        ],
        links: [{ href: '/methode', label: 'Methode' }],
      },
    ],
  },
  dekking: {
    slug: 'dekking',
    eyebrow: 'Huidige vergelijkingsbasis',
    title: 'Dekking van de vergelijking',
    introduction:
      'De vergelijking geldt voor Nederland en voor luiers, luierbroekjes en billendoekjes. Claims gelden alleen binnen deze vergelijking, nooit als complete markt of als goedkoopste van Nederland.',
    sections: [
      {
        title: 'Publieke statussen',
        paragraphs: [
          'Elke beoogde retailer heeft één publieke status: actief, tijdelijk gepauzeerd of nog niet actief. Actieve retailers tonen de laatste succesvolle controle. Bij een publieke pauze geven we alleen een feitelijke, niet-gevoelige reden.',
        ],
      },
      {
        title: 'Fixture-vergelijking',
        paragraphs: [
          'Deze publieke reis gebruikt nu deterministische fixturegegevens. Productwaarheid, rangschikking en outbound bestemmingen volgen die fixture, tot een retailer na de activatiepoort live gaat.',
        ],
      },
    ],
    coverage: true,
  },
  privacy: {
    slug: 'privacy',
    eyebrow: 'Dataminimalisatie',
    title: 'Privacy',
    introduction:
      'De openbare vergelijking vraagt geen account en bewaart finderkeuzes niet als persoonlijk profiel.',
    sections: [
      {
        title: 'Verwerkingsverantwoordelijke',
        paragraphs: [
          `De exploitant van ${publicSiteName} is verwerkingsverantwoordelijke. Het gepubliceerde contactkanaal is ${publicContactEmail}. KvK-nummer en vestigingsadres worden in deze brontekst gezet zodra de formele inschrijving rond is.`,
          `Je kunt een klacht indienen bij de Autoriteit Persoonsgegevens.`,
        ],
        links: [
          { href: `mailto:${publicContactEmail}`, label: publicContactEmail },
        ],
      },
      {
        title: 'Welke gegevens we verwerken',
        paragraphs: [
          'Cloudflare verwerkt verzoeken, beveiligings- en operationele logboeken voor hosting van deze site. Wij tellen aggregaat outbound-intentie zonder bezoeker-, sessie- of apparaatkenmerk, IP-adres, user-agent of ruwe URL-geheimen. E-mailcontact bewaren we alleen zolang nodig is om te antwoorden, of langer als een wettelijke plicht of een geschil dat vraagt.',
          'Een optionele thema-afwijking blijft lokaal in je browser. Babyboel zet geen trackingcookies voor analytics. Na een retailerklik kunnen de retailer of het affiliatenetwerk eigen cookies of attributie plaatsen; dat valt onder hun voorwaarden.',
        ],
      },
      {
        title: 'Grondslagen en beveiliging',
        paragraphs: [
          'Cloudflare-verzoeken en beveiligingslogboeken verwerken we op grond van gerechtvaardigd belang (AVG artikel 6 lid 1 sub f) om de site te leveren en te beveiligen. E-mailcontact verwerken we om je bericht te behandelen (AVG artikel 6 lid 1 sub b of sub f, afhankelijk van de aard van het verzoek). Aggregaat intentietellingen zijn geen persoonsgegevens: geen bezoeker-, sessie- of apparaatkenmerk, IP-adres of user-agent. Een optionele thema-afwijking blijft alleen op je apparaat.',
          'We beperken toegang tot beheer, zetten geen trackingcookies voor eigen analytics, en bewaren geen bezoekersprofiel. Verzoeken lopen via Cloudflare. Geheimen horen in Cloudflare secrets, niet in deze brontekst.',
        ],
      },
      {
        title: 'Rechten',
        paragraphs: [
          'Je kunt inzage, correctie of verwijdering van correspondentie vragen via het contactadres. Verwijdering van mailboxberichten is een handmatige operatoractie.',
        ],
      },
    ],
  },
  contact: {
    slug: 'contact',
    eyebrow: 'Vragen en correcties',
    title: 'Contact',
    introduction: `Mail ${publicContactEmail}. Stuur geen gezondheidsgegevens, betaalgegevens, accountwachtwoorden of andere gevoelige gegevens die we niet nodig hebben.`,
    sections: [
      {
        title: 'Onderwerp kiezen',
        paragraphs: [
          'Prijs of Product corrigeren: onderwerp “Correctie prijs/Product”. Noem de Productpagina en de Listing.',
          'Retailerverzoek of takedown: onderwerp “Retailerverzoek”. Beschrijf de Listing en je bevoegdheid.',
          'Privacyrechten: onderwerp “Privacyrechten”. Beschrijf je verzoek zonder extra persoonsgegevens.',
          'Toegankelijkheid: onderwerp “Toegankelijkheid”. Beschrijf de pagina en wat er misgaat.',
          'Overig of dringend juridisch contact: onderwerp “Contact”. Gebruik hetzelfde adres.',
        ],
        links: [
          { href: `mailto:${publicContactEmail}`, label: publicContactEmail },
        ],
      },
    ],
  },
}

export function trustPageHead(page: TrustPageContent) {
  return {
    meta: [
      { title: `${page.title} — Babyboel` },
      { name: 'description', content: page.introduction },
      { property: 'og:title', content: page.title },
      { property: 'og:description', content: page.introduction },
      { property: 'og:url', content: `${publicSiteOrigin}/${page.slug}` },
      { property: 'og:locale', content: 'nl_NL' },
    ],
    links: [{ rel: 'canonical', href: `${publicSiteOrigin}/${page.slug}` }],
  }
}

export function TrustPage({ page }: { page: TrustPageContent }) {
  return (
    <main className="page" id="main" tabIndex={-1}>
      <nav aria-label="Kruimelpad">
        <ol className="breadcrumbs">
          <li>
            <a href="/">Home</a>
          </li>
          <li aria-current="page">{page.title}</li>
        </ol>
      </nav>
      <p className="eyebrow">{page.eyebrow}</p>
      <h1>{page.title}</h1>
      <p className="lede">{page.introduction}</p>
      <p className="fine-print">Laatst bijgewerkt op {publicTrustUpdatedOn}.</p>
      <div className="trust-sections">
        {page.sections.map((section) => (
          <section className="surface" key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.links?.map((link) => (
              <p key={link.href}>
                <a href={link.href}>{link.label}</a>
              </p>
            ))}
          </section>
        ))}
        {page.coverage && (
          <section className="surface">
            <h2>Retailers in deze vergelijking</h2>
            <dl className="coverage-list">
              {publicRetailerCoverage.map((retailer) => (
                <div key={retailer.name}>
                  <dt>{retailer.name}</dt>
                  <dd>
                    <strong>{coverageStatusLabel[retailer.status]}</strong>
                    <span>{retailer.detail}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </main>
  )
}
