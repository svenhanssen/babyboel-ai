import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main id="main">
      <p className="eyebrow">Nederlandse prijsvergelijker</p>
      <h1>Vind een passende actuele aanbieding</h1>
      <p>
        Babyboel wordt opgebouwd rond controleerbare Producten, Packages,
        Listings en Offers. De vergelijkingsreis volgt in een volgende verticale
        slice.
      </p>
    </main>
  )
}
