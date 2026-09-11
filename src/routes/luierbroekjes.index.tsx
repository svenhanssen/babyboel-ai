import { createFileRoute } from '@tanstack/react-router'

import { publicCategoryBySlug } from '../public/catalog'
import { CategoryLanding } from '../public/pages'

export const Route = createFileRoute('/luierbroekjes/')({
  head: () => ({
    meta: [
      { title: 'Luierbroekjes vergelijken per maat — Babyboel' },
      {
        name: 'description',
        content: 'Kies een exacte maat en vergelijk actuele luierbroekjes.',
      },
    ],
    links: [{ rel: 'canonical', href: 'https://babyboel.nl/luierbroekjes' }],
  }),
  component: () => (
    <CategoryLanding category={publicCategoryBySlug.luierbroekjes} />
  ),
})
