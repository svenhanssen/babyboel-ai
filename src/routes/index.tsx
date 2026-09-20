import { createFileRoute } from '@tanstack/react-router'

import { publicCategories } from '../public/catalog'
import { normalizedSizeToRoute } from '../public/pages'
import { homeStructuredData, publicSiteOrigin } from '../public/seo'
import { PriceHistory } from '../ui/price-history'

const finderSizes = [...new Set(publicCategories.flatMap(({ sizes }) => sizes))]

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Babyboel — vergelijk actuele luierprijzen' },
      {
        name: 'description',
        content:
          'Vind en vergelijk actuele Nederlandse Offers voor luiers, luierbroekjes en billendoekjes.',
      },
      {
        property: 'og:title',
        content: 'Babyboel — vergelijk actuele luierprijzen',
      },
      {
        property: 'og:description',
        content:
          'Vind en vergelijk actuele Nederlandse Offers voor luiers, luierbroekjes en billendoekjes.',
      },
      { property: 'og:url', content: `${publicSiteOrigin}/` },
      { property: 'og:locale', content: 'nl_NL' },
    ],
    links: [{ rel: 'canonical', href: `${publicSiteOrigin}/` }],
  }),
  component: Home,
})

function Home() {
  return (
    <main className="page" id="main" tabIndex={-1}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeStructuredData()),
        }}
      />
      <section className="hero" aria-labelledby="home-heading">
        <div>
          <p className="eyebrow">Nederlandse prijsvergelijker</p>
          <h1 id="home-heading">Vind een passende actuele Offer</h1>
          <p className="lede">
            Vergelijk luiers, luierbroekjes en doekjes op actuele prijs,
            voorwaarden en controleerbare productgegevens. Babyboel is een
            Nederlandse prijsvergelijker, geen winkel. Sommige retailerlinks
            kunnen commissie opleveren zonder de rangschikking te veranderen.
          </p>
          <p>
            <a href="/methode">Methode</a>
            {' · '}
            <a href="/verdienmodel">Verdienmodel</a>
          </p>
          <a className="button" href="#finder">
            Start met vergelijken
          </a>
        </div>
        <svg
          aria-hidden="true"
          className="hero-illustration"
          fill="none"
          viewBox="0 0 320 240"
        >
          <path d="M58 169c27-47 42-89 94-103 42-11 91 8 108 47 18 40-4 83-48 94-52 14-120 4-154-38Z" />
          <path d="M88 153c31-8 50-29 66-63M145 180c18-28 42-48 76-58M179 94c13 10 22 24 27 41" />
          <circle cx="91" cy="154" r="9" />
          <circle cx="224" cy="120" r="9" />
        </svg>
      </section>

      <section aria-labelledby="finder-heading" id="finder">
        <p className="eyebrow">Eén duidelijke basis</p>
        <h2 id="finder-heading">Kies categorie en maat</h2>
        <p>
          De finder gebruikt alleen exacte cataloguskeuzes en doet geen
          persoonlijke aanbeveling.
        </p>
        <form action="/vinden" className="finder" method="get">
          <label>
            Categorie
            <select name="categorie" required>
              {publicCategories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Genormaliseerde maat
            <select name="maat">
              <option value="">Niet van toepassing / nog kiezen</option>
              {finderSizes.map((size) => (
                <option key={size} value={size}>
                  Maat {size}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            Toon passende Products
          </button>
        </form>
        <div className="category-grid">
          {publicCategories.map((category) => (
            <article className="surface" key={category.slug}>
              <h3>{category.name}</h3>
              <p>
                {category.sizes.length > 0
                  ? 'Kies rechtstreeks een exacte maat.'
                  : 'Vergelijk direct zonder maatstap.'}
              </p>
              {category.sizes.length > 0 ? (
                <ul className="inline-list">
                  {category.sizes.map((size) => (
                    <li key={size}>
                      <a
                        href={`/${category.slug}/maat-${normalizedSizeToRoute(size)}`}
                      >
                        Maat {size}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <a href={`/${category.slug}`}>Bekijk {category.name}</a>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="history-example-heading" className="example">
        <p className="eyebrow">Controleerbare historie</p>
        <h2 id="history-example-heading">Prijsontwikkeling zonder aannames</h2>
        <p>
          Dit voorbeeld laat zien hoe Babyboel waarnemingen toont. Een dag
          zonder bewijs blijft zichtbaar als een onderbreking.
        </p>
        <PriceHistory
          points={[
            { observedOn: '2026-08-24', priceCents: 1299 },
            { observedOn: '2026-08-25', priceCents: 1249 },
            { observedOn: '2026-08-26', priceCents: null },
            { observedOn: '2026-08-27', priceCents: 1199 },
            { observedOn: '2026-08-28', priceCents: 1249 },
          ]}
        />
      </section>
    </main>
  )
}
