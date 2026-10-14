import { expect, test, type Page } from '@playwright/test'

// Seed, при котором 50 тиков после openPortal дают критический портал (src/app/store.test.ts)
const SEED = 3

// В e2e нет DOM-типов, поэтому хук читаем через globalThis
type LabGlobal = { __lab?: { advance(ticks: number): void } }

async function advance(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), ticks)
}

test('test=1 открывает хук __lab, время идёт только по advance', async ({ page }) => {
  await page.goto(`/?seed=${SEED}&test=1`)
  expect(await page.evaluate(() => (globalThis as LabGlobal).__lab !== undefined)).toBe(true)

  // Тестовый режим стартует на паузе: время в HUD стоит, пока его не прокрутят
  await expect(page.getByRole('button', { name: 'Пауза' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('мин 0', { exact: true })).toBeVisible()

  await advance(page, 50)
  await expect(page.getByText('мин 50', { exact: true })).toBeVisible()

  await advance(page, 50)
  await expect(page.getByText('мин 100', { exact: true })).toBeVisible()
})

test('без test=1 хука __lab нет', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate(() => (globalThis as LabGlobal).__lab)).toBeUndefined()
})
