export interface PriceHistoryPoint {
  observedOn: string
  priceCents: number | null
}

const chartWidth = 600
const chartHeight = 240
const chartInset = 32

const dateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const priceFormatter = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

function formatDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`))
}

function formatPrice(priceCents: number) {
  return priceFormatter.format(priceCents / 100)
}

function chartPaths(points: PriceHistoryPoint[]) {
  const prices = points.flatMap(({ priceCents }) =>
    priceCents === null ? [] : [priceCents],
  )
  if (prices.length === 0) return { paths: [], coordinates: [] }

  const minimum = Math.min(...prices)
  const maximum = Math.max(...prices)
  const range = Math.max(maximum - minimum, 1)
  const horizontalRange = chartWidth - chartInset * 2
  const verticalRange = chartHeight - chartInset * 2
  const coordinates = points.map(({ priceCents }, index) => {
    if (priceCents === null) return null
    const x =
      chartInset +
      (points.length === 1
        ? horizontalRange / 2
        : (index / (points.length - 1)) * horizontalRange)
    const y = chartInset + ((maximum - priceCents) / range) * verticalRange
    return { x, y }
  })

  const paths: string[] = []
  let activePath = ''
  for (const coordinate of coordinates) {
    if (coordinate === null) {
      if (activePath) paths.push(activePath)
      activePath = ''
      continue
    }

    activePath += `${activePath ? ' L' : 'M'} ${coordinate.x} ${coordinate.y}`
  }
  if (activePath) paths.push(activePath)

  return { paths, coordinates }
}

export function PriceHistory({ points }: { points: PriceHistoryPoint[] }) {
  const { paths, coordinates } = chartPaths(points)

  return (
    <figure className="price-history">
      <figcaption>
        <strong className="price-history__title">Prijsgeschiedenis</strong>
        <p>
          Ontbrekende waarnemingen blijven als onderbreking zichtbaar; er wordt
          niets geïnterpoleerd.
        </p>
      </figcaption>
      <svg
        aria-hidden="true"
        className="price-history__chart"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        {[0, 1, 2, 3, 4].map((line) => {
          const y = chartInset + (line / 4) * (chartHeight - chartInset * 2)
          return (
            <line
              className="price-history__grid"
              key={line}
              x1={chartInset}
              x2={chartWidth - chartInset}
              y1={y}
              y2={y}
            />
          )
        })}
        {paths.map((path) => (
          <path className="price-history__line" d={path} key={path} />
        ))}
        {coordinates.map((coordinate, index) =>
          coordinate === null ? null : (
            <circle
              className="price-history__point"
              cx={coordinate.x}
              cy={coordinate.y}
              key={points[index]?.observedOn}
              r="5"
            />
          ),
        )}
      </svg>
      <div
        aria-label="Schuifbare prijstabel"
        className="price-history__table-scroll"
        role="region"
        tabIndex={0}
      >
        <table aria-label="Prijsgeschiedenis als tabel">
          <caption>Prijsgeschiedenis als tabel</caption>
          <thead>
            <tr>
              <th scope="col">Datum</th>
              <th scope="col">Waargenomen prijs</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.observedOn}>
                <th scope="row">
                  <time dateTime={point.observedOn}>
                    {formatDate(point.observedOn)}
                  </time>
                </th>
                <td>
                  {point.priceCents === null
                    ? 'Geen waarneming'
                    : formatPrice(point.priceCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
