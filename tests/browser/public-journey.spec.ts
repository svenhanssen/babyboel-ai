import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const axePath = resolve('node_modules/axe-core/axe.min.js')

test('finder to browse to exact Product and outbound disclosure', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('combobox', { name: 'Categorie', exact: true })
    .selectOption('luiers')
  await page
    .getByRole('combobox', { name: 'Genormaliseerde maat', exact: true })
    .selectOption('4+')
  await page.getByRole('button', { name: 'Toon passende Products' }).click()

  await expect(page).toHaveURL(/\/vinden\?categorie=luiers&maat=4(%2B|\+)/)
  await page
    .getByRole('link', { name: 'Bekijk de volledige vergelijking' })
    .click()
  await expect(page).toHaveURL('/luiers/maat-4-plus')
  await expect(page.getByText('26 Products')).toBeVisible()

  await page
    .getByRole('link', { name: /Bekijk Zacht & Start Original/ })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Aanbiedingen voor iedereen' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Aanbiedingen met voorwaarden' }),
  ).toBeVisible()

  const outbound = page.getByRole('link', { name: 'Bekijk bij Plein' }).first()
  await expect(outbound).toHaveAttribute(
    'href',
    'https://retailer.example/plein-multi',
  )
  await expect(outbound).not.toHaveAttribute('target', '_blank')
  await expect(page.getByText(/kan commissie opleveren/)).toBeVisible()

  await page.addScriptTag({ path: axePath })
  const violations = await page.evaluate(async () => {
    const axe = (
      window as typeof window & {
        axe: { run: () => Promise<{ violations: unknown[] }> }
      }
    ).axe
    return (await axe.run()).violations
  })
  expect(violations).toEqual([])
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('keeps browse, Product, and exact retailer destination reachable', async ({
    page,
  }) => {
    await page.goto('/luiers/maat-4-plus?page=2')
    await expect(page.getByText('Pagina 2 van 2')).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://babyboel.nl/luiers/maat-4-plus?page=2',
    )
    await expect(page.locator('.product-card')).toHaveCount(2)
    await page.getByRole('link', { name: 'Vorige' }).click()
    await expect(page).toHaveURL('/luiers/maat-4-plus')
    await expect(page.locator('.product-card')).toHaveCount(24)
    await page.getByRole('link', { name: 'Volgende' }).click()
    await expect(page).toHaveURL('/luiers/maat-4-plus?page=2')
    await page.getByRole('link', { name: /Bekijk Zacht & Start Nacht/ }).click()
    await expect(page.getByText('Geen actuele aanbieding')).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'Prijsgeschiedenis als tabel' }),
    ).toBeVisible()

    await page.goto('/producten/zacht-start-original-maat-4-plus-p001')
    const outbound = page
      .getByRole('link', { name: 'Bekijk bij Plein' })
      .first()
    await expect(outbound).toHaveAttribute(
      'href',
      'https://retailer.example/plein-multi',
    )
  })
})

test('shows honest no-current and degraded states', async ({ page }) => {
  await page.goto('/producten/zacht-start-nacht-maat-4-plus-p025')
  await expect(page.getByText('Geen actuele aanbieding')).toBeVisible()
  await expect(page.getByRole('link', { name: /Bekijk bij/ })).toHaveCount(0)

  await page.goto('/producten/zacht-start-comfort-maat-4-plus-p026')
  await expect(page.getByText('Vergelijking tijdelijk beperkt')).toBeVisible()
  await expect(page.getByText(/Wehkamp/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Bekijk bij/ })).toHaveCount(0)
})

test('reflows and preserves visible keyboard navigation on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/producten/zacht-start-original-maat-4-plus-p001')

  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('link', { name: 'Naar hoofdinhoud' }),
  ).toBeFocused()
  expect(
    await page
      .locator('body')
      .evaluate(
        (body) => body.scrollWidth <= document.documentElement.clientWidth,
      ),
  ).toBe(true)
  await expect(
    page.getByRole('table', { name: 'Prijsgeschiedenis als tabel' }),
  ).toBeVisible()
})

test('rejects invalid public selections and keeps trust links live', async ({
  page,
  request,
}) => {
  await page.goto('/vinden?categorie=onbekend&maat=4')
  await expect(page.getByText('Selectie niet herkend')).toBeVisible()

  await page.goto('/vinden?categorie=billendoekjes&maat=4')
  await expect(page.getByText('Selectie niet herkend')).toBeVisible()
  expect((await request.get('/billendoekjes?page=2')).status()).toBe(404)

  for (const path of [
    '/methode',
    '/verdienmodel',
    '/dekking',
    '/privacy',
    '/contact',
  ]) {
    expect((await request.get(path)).status()).toBe(200)
  }
})
