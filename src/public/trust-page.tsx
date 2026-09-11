export interface TrustPageContent {
  slug: 'methode' | 'verdienmodel' | 'dekking' | 'privacy' | 'contact'
  eyebrow: string
  title: string
  introduction: string
  sections: Array<{ title: string; body: string }>
}

export const trustPageLinks = [
  { href: '/methode', label: 'Methode' },
  { href: '/verdienmodel', label: 'Verdienmodel' },
  { href: '/dekking', label: 'Dekking' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/contact', label: 'Contact' },
] as const

export const trustPages: Record<TrustPageContent['slug'], TrustPageContent> = {
  methode: {
    slug: 'methode',
    eyebrow: 'Controleerbaar vergelijken',
    title: 'Zo vergelijkt Babyboel',
    introduction:
      'We vergelijken alleen exact gekoppelde Products, Packages, Listings en actuele Offers.',
    sections: [
      {
        title: 'Rangschikking',
        body: 'De laagste universele stukprijs staat eerst. We rekenen met gehele centen en aantallen; restricted Offers veranderen de hoofdvolgorde niet.',
      },
      {
        title: 'Actualiteit',
        body: 'Een Offer is alleen actueel wanneer prijs, voorwaarden, beschikbaarheid en bestemming binnen 48 uur zijn bevestigd.',
      },
    ],
  },
  verdienmodel: {
    slug: 'verdienmodel',
    eyebrow: 'Onafhankelijke productwaarheid',
    title: 'Hoe Babyboel geld kan verdienen',
    introduction:
      'Een retailerlink kan commissie opleveren. Dat verandert nooit welke Offer wordt opgenomen of hoe die wordt gerangschikt.',
    sections: [
      {
        title: 'Geen verkoper',
        body: 'Babyboel verkoopt geen Products. De retailer bepaalt de uiteindelijke bestelling, levering en voorwaarden.',
      },
    ],
  },
  dekking: {
    slug: 'dekking',
    eyebrow: 'Huidige vergelijkingsbasis',
    title: 'Dekking van de vergelijking',
    introduction:
      'De publieke reis gebruikt nu een deterministische fixture met Products voor luiers, luierbroekjes en billendoekjes.',
    sections: [
      {
        title: 'Fail closed',
        body: 'Als een retailer tijdelijk niet betrouwbaar gecontroleerd kan worden, onderdrukken we de prijs en retaileractie in plaats van te gokken.',
      },
    ],
  },
  privacy: {
    slug: 'privacy',
    eyebrow: 'Dataminimalisatie',
    title: 'Privacy',
    introduction:
      'De openbare vergelijking vraagt geen account en bewaart geen finderkeuzes als persoonlijk profiel.',
    sections: [
      {
        title: 'Lokale voorkeur',
        body: 'Alleen een eventuele handmatige thema-afwijking wordt lokaal in de browser bewaard.',
      },
    ],
  },
  contact: {
    slug: 'contact',
    eyebrow: 'Vragen en correcties',
    title: 'Contact',
    introduction:
      'Zie je een onjuiste Product-identiteit, prijs of voorwaarde? Meld precies om welke Product- en retailerpagina het gaat.',
    sections: [
      {
        title: 'Voor de publieke lancering',
        body: 'Het gecontroleerde openbare contactkanaal wordt bij de handmatige launch gate toegevoegd. Tot die tijd verwerkt de operator correcties via de beschermde beheeromgeving.',
      },
    ],
  },
}

export function trustPageHead(page: TrustPageContent) {
  return {
    meta: [
      { title: `${page.title} — Babyboel` },
      { name: 'description', content: page.introduction },
    ],
    links: [{ rel: 'canonical', href: `https://babyboel.nl/${page.slug}` }],
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
      <div className="trust-sections">
        {page.sections.map((section) => (
          <section className="surface" key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>
    </main>
  )
}
