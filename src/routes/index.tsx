import { createFileRoute } from '@tanstack/react-router'

import { PriceHistory } from '../ui/price-history'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="page" id="main" tabIndex={-1}>
      <section className="hero" aria-labelledby="home-heading">
        <div>
          <p className="eyebrow">Nederlandse prijsvergelijker</p>
          <h1 id="home-heading">Vind een passende actuele aanbieding</h1>
          <p className="lede">
            Vergelijk luiers, luierbroekjes en doekjes op actuele prijs,
            voorwaarden en controleerbare productgegevens.
          </p>
          <a className="button" href="#categorieen">
            Bekijk categorieën
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

      <section aria-labelledby="categories-heading" id="categorieen">
        <p className="eyebrow">Eén duidelijke basis</p>
        <h2 id="categories-heading">Vergelijk wat bij je gezin past</h2>
        <div className="category-grid">
          {['Luiers', 'Luierbroekjes', 'Doekjes'].map((category) => (
            <article className="surface" key={category}>
              <span className="tag">Binnenkort beschikbaar</span>
              <h3>{category}</h3>
              <p>
                Actuele Offers worden alleen getoond wanneer Product en Package
                betrouwbaar vergelijkbaar zijn.
              </p>
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
