import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './overflow.ts'

/*
 * Обучение (docs/spec.md §12): приглашение на чистом старте и полный путь в песочнице.
 * Песочница идёт с seed 54: первый портал — ЗК-005-1 (Забытый Курган, 4 существа).
 */

const coach = (page: Page) => page.getByRole('complementary', { name: 'Обучение' })
const step = (page: Page, n: number) =>
  expect(coach(page).getByText(/^ОБУЧЕНИЕ/)).toHaveText(`ОБУЧЕНИЕ · ${n} / 13`)
const ring = (page: Page) => page.getByTestId('tour-ring')
// Недоступная способность приглушена (aria-disabled), но нажимается — Playwright без force ждёт
const ability = (page: Page, name: string) =>
  page
    .getByRole('group', { name: 'Способности' })
    .getByRole('button', { name: new RegExp(`^${name}`) })

async function walk(page: Page): Promise<void> {
  await step(page, 1)
  await expect(ring(page)).toBeVisible()
  await page.getByRole('button', { name: 'Открыть портал в арке 1', exact: true }).click()
  await step(page, 2)
  await page.getByRole('button', { name: 'Открыть карточку портала ЗК-005-1' }).click()
  await step(page, 3)
  await ability(page, 'Отправить наблюдателя').click()
  await step(page, 4)
  await ability(page, 'Под вопросом').click()
  await page.getByRole('button', { name: 'Пометить' }).click()
  await step(page, 5)
  await ability(page, 'Стабилизировать').click()
  await step(page, 6)
  await ability(page, 'Закрыть').click({ force: true })
  await step(page, 7)
  await expect(page.getByText('На месте наблюдатели — сначала отзовите').first()).toBeVisible()
  await ability(page, 'Отозвать наблюдателей').click()
  await step(page, 8)
  await ability(page, 'Закрыть').click()
  await page.getByRole('button', { name: 'Закрыть всё равно' }).click()
  await step(page, 9)
  await page.getByRole('button', { name: 'Закрыть карточку' }).click()
  await step(page, 10)
  await page.getByRole('link', { name: 'Атлас миров' }).click()
  await step(page, 11)
  await page.getByRole('link', { name: 'Книга журнала' }).click()
  await step(page, 12)
  await page.getByRole('link', { name: 'AI Worklog' }).click()
  await step(page, 13)
  await coach(page).getByRole('button', { name: 'В лабораторию' }).click()
  await expect(coach(page)).toHaveCount(0)
}

test.describe('обучение', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('чистый старт: приглашение, «Пропустить», после перезагрузки его нет', async ({ page }) => {
    await page.goto('/?seed=1')
    const offer = page.getByRole('dialog', { name: 'ДОБРО ПОЖАЛОВАТЬ, СМОТРИТЕЛЬ' })
    await expect(offer).toBeVisible()
    await offer.getByRole('button', { name: 'Пропустить' }).click()
    await expect(offer).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Обучение' })).toBeVisible()
    await expect(offer).toHaveCount(0)
  })

  test('тестовый режим не показывает приглашение', async ({ page }) => {
    await page.goto('/?seed=1&test=1')
    await expect(page.getByRole('button', { name: 'Обучение' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('полный путь из приглашения', async ({ page }) => {
    await page.goto('/?seed=1')
    await page.getByRole('button', { name: 'Пройти обучение' }).click()
    await walk(page)
    await expect(page.getByRole('button', { name: /^Открыть портал в арке/ })).toHaveCount(12)
  })

  test('своя лаборатория после обучения цела и стоит на прежней скорости', async ({ page }) => {
    await page.goto('/?seed=3&test=1')
    await page.getByRole('button', { name: 'Открыть портал в арке 1', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Открыть карточку портала ПП-076-1' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Обучение' }).click()
    // Песочница пуста: своего портала в ней нет
    await expect(page.getByRole('button', { name: /^Открыть портал в арке/ })).toHaveCount(12)
    await walk(page)

    await expect(
      page.getByRole('button', { name: 'Открыть карточку портала ПП-076-1' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Открыть карточку портала ЗК-005-1' }),
    ).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Пауза' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'Открыть карточку портала ПП-076-1' }),
    ).toBeVisible()
  })
})

test.describe('обучение на узком экране', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('полный путь, док без горизонтальной прокрутки', async ({ page }) => {
    await page.goto('/?seed=1&test=1')
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Обучение' }).click()
    await walk(page)
    await expectNoHorizontalOverflow(page)
  })
})
