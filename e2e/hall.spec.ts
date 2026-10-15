import { expect, test, type Page } from '@playwright/test'

// Seed, при котором 50 тиков после openPortal дают критический портал (src/app/store.test.ts)
const SEED = 3

type LabGlobal = { __lab?: { advance(ticks: number): void } }

async function advance(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), ticks)
}

test('пустая лаборатория показывает пустое состояние', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  await expect(page.getByText('Порталов нет — активируйте первую арку')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Открыть портал в арке \d+$/ })).toHaveCount(12)
  await expect(page.getByText('нажмите — откроется портал')).toBeVisible()
})

test('пустая арка открывает портал; критический портал горит в зале', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  await page.getByRole('button', { name: 'Открыть портал в арке 7', exact: true }).click()

  // Портал встаёт в первую свободную арку, под ней — табличка
  await expect(page.getByRole('button', { name: /^Открыть портал в арке \d+$/ })).toHaveCount(11)
  await expect(
    page.getByRole('button', { name: 'Открыть портал в арке 1', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByText('Порталов нет — активируйте первую арку')).toHaveCount(0)

  await advance(page, 50)
  await expect(page.locator('.px-portal--critical')).toHaveCount(1)
  // Слово риска стоит и на табличке арки, и на записке «Тревожных знаков»
  await expect(page.getByText('КРИТИЧЕСКИЙ', { exact: true })).toHaveCount(2)
  const note = page.getByRole('region', { name: 'Тревожные знаки' }).getByRole('button')
  await expect(note).toHaveCount(1)
  await expect(note).toContainText('КРИТИЧЕСКИЙ')

  const opened = page.getByRole('button', { name: /^Открыть карточку портала/ })
  const name = (await opened.getAttribute('aria-label'))!.replace('Открыть карточку портала ', '')
  await opened.click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
})

test('схлопнувшийся портал гаснет, и арка снова пуста', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  await page.getByRole('button', { name: 'Открыть портал в арке 1', exact: true }).click()
  await advance(page, 400)

  // Плашка на арке; баннер «ПОРТАЛ СХЛОПНУЛСЯ» с ней не путаем (exact)
  await expect(page.getByText('СХЛОПНУЛСЯ', { exact: true })).toBeVisible()
  // Анимация идёт и на паузе (тестовый режим стартует на паузе) и кончается сама
  await expect(page.getByRole('button', { name: /^Открыть портал в арке \d+$/ })).toHaveCount(12)
  await expect(page.getByText('СХЛОПНУЛСЯ', { exact: true })).toHaveCount(0)
})
