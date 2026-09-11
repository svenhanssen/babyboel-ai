import { createFileRoute } from '@tanstack/react-router'

import { publicCategoryBySlug } from '../public/catalog'
import { CategoryLanding } from '../public/pages'

export const Route = createFileRoute('/luiers/')({
  head: () => ({
    meta: [
      { title: 'Luiers vergelijken per maat — Babyboel' },
      {
        name: 'description',
        content: 'Kies een exacte luiermaat en vergelijk actuele Offers.',
      },
    ],
    links: [{ rel: 'canonical', href: 'https://babyboel.nl/luiers' }],
  }),
  component: () => <CategoryLanding category={publicCategoryBySlug.luiers} />,
})
