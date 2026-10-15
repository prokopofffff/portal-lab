import { expect, test, type Page } from '@playwright/test'

// Seed, при котором 50 тиков после openPortal дают критический портал (src/app/store.test.ts)
const SEED = 3

type LabGlobal = { __lab?: { advance(ticks: number): void } }

async function advance(page: Page, ticks: number): Promise<void> {
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), ticks)
}

// Критический портал: из карточки отправить наблюдателя нельзя — выйдет отказ
async function openCriticalCard(page: Page) {
  await page.goto(`/?seed=${SEED}&test=1`)
  await page.getByRole('button', { name: 'Арка 1 пуста — открыть портал' }).click()
  await advance(page, 50)
  await expect(page.locator('.px-portal--critical')).toHaveCount(1)
  await page.getByRole('region', { name: 'Тревожные знаки' }).getByRole('button').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

test('на 1440×1000 баннер отказа не закрывает способности карточки', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const dialog = await openCriticalCard(page)
  const abilities = dialog.getByRole('group', { name: 'Способности' })

  const send = abilities.getByRole('button', { name: 'Отправить наблюдателя' })
  await send.focus()
  await page.keyboard.press('Enter')
  const banner = page.getByRole('alert')
  await expect(banner).toContainText('ОТКАЗ')

  // Ждём конца въезда баннера (bnIn, 0.5 с): до него он сдвинут на 40 px вправо
  await page.waitForTimeout(600)
  const a = (await abilities.boundingBox())!
  const b = (await banner.boundingBox())!
  const intersects =
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  expect(intersects).toBe(false)

  // Раскладка кадра 05-card-rejection: карточка 300…900, полоса баннеров 940…1420
  const card = (await dialog.boundingBox())!
  expect(card.x + card.width).toBeCloseTo(900, 0)
  expect(b.x).toBeCloseTo(940, 0)
  expect(b.x + b.width).toBeCloseTo(1420, 0)
})
