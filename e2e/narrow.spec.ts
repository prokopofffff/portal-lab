import { expect, test, type Locator, type Page } from '@playwright/test'

type LabGlobal = { __lab?: { advance(ticks: number): void } }

// Узкий экран: брейкпоинт 900 px, проверяем на 390×844
const NARROW = { width: 390, height: 844 }

/**
 * Рамка элемента внутри окна и сам элемент без горизонтальной прокрутки: нигде не вылезает за
 * 0…ширина окна, а его и его потомков scrollWidth не больше clientWidth. Для страницы целиком
 * проверяется документ.
 */
export async function expectNoHorizontalOverflow(target: Page | Locator): Promise<void> {
  if ('goto' in target) {
    const inner = target.viewportSize()!.width
    const scroll = await target.evaluate((): number => {
      return (globalThis as unknown as { document: { documentElement: { scrollWidth: number } } })
        .document.documentElement.scrollWidth
    })
    expect(scroll, 'документ шире окна').toBeLessThanOrEqual(inner)
    return
  }
  const inner = target.page().viewportSize()!.width
  const { box, overflowing } = await target.evaluate((root) => {
    const rect = root.getBoundingClientRect()
    // Элементы, содержимое которых шире самих себя (текст, вылезающий из кнопки, и т. п.)
    const bad = [root, ...root.querySelectorAll('*')]
      .filter((el) => el.scrollWidth > el.clientWidth && el.clientWidth > 0)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
    return { box: { left: rect.left, right: rect.right }, overflowing: bad }
  })
  expect(box.left, 'левый край левее окна').toBeGreaterThanOrEqual(0)
  expect(box.right, 'правый край правее окна').toBeLessThanOrEqual(inner)
  expect(overflowing, 'содержимое шире своего блока').toEqual([])
}

test.describe('узкий экран, 390×844: HUD и док', () => {
  test.use({ viewport: NARROW })

  test('HUD и док видны и помещаются по ширине', async ({ page }) => {
    await page.goto('/?seed=3&test=1')
    const hud = page.getByRole('banner')
    const dock = page.getByRole('navigation', { name: 'Разделы' }).locator('..')
    await expect(hud).toBeVisible()
    await expect(dock).toBeVisible()
    await expectNoHorizontalOverflow(hud)
    await expectNoHorizontalOverflow(dock)
  })

  test('HUD идёт строками: время и скорость, наблюдатели, счётчики на всю ширину', async ({
    page,
  }) => {
    await page.goto('/?seed=3&test=1')
    const hud = page.getByRole('banner')
    const top = async (loc: Locator) => (await loc.boundingBox())!.y
    const clock = hud.getByText('ВРЕМЯ')
    const speed = hud.getByText('СКОРОСТЬ')
    const staff = hud.getByText('НАБЛЮДАТЕЛИ')
    const stats = hud.locator('dl')
    expect(Math.abs((await top(clock)) - (await top(speed)))).toBeLessThan(20)
    expect(await top(staff)).toBeGreaterThan(await top(clock))
    expect(await top(stats)).toBeGreaterThan(await top(staff))
    const hudBox = (await hud.boundingBox())!
    const statsBox = (await stats.boundingBox())!
    expect(statsBox.width).toBeGreaterThan(hudBox.width - 40)
    // «Нанять» остаётся доступной и не ниже 44 px
    const hire = hud.getByRole('button', { name: 'Нанять' })
    await expect(hire).toBeVisible()
    expect((await hire.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })

  test('кнопки скорости не ниже 44 px и работают', async ({ page }) => {
    await page.goto('/?seed=3&test=1')
    const fast = page.getByRole('button', { name: 'Скорость ×5' })
    const box = (await fast.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    await fast.click()
    await expect(fast).toHaveAttribute('aria-pressed', 'true')
  })

  test('в доке три вкладки поровну, не ниже 44 px, «Запечатать» отдельной строкой справа', async ({
    page,
  }) => {
    await page.goto('/?seed=3&test=1')
    const tabs = page.getByRole('navigation', { name: 'Разделы' }).getByRole('link')
    await expect(tabs).toHaveCount(3)
    const boxes = await Promise.all([0, 1, 2].map(async (i) => (await tabs.nth(i).boundingBox())!))
    for (const b of boxes) {
      expect(b.height).toBeGreaterThanOrEqual(44)
      expect(Math.abs(b.width - boxes[0]!.width)).toBeLessThan(1)
    }
    const seal = page.getByRole('button', { name: 'Запечатать лабораторию' })
    const sealBox = (await seal.boundingBox())!
    expect(sealBox.height).toBeGreaterThanOrEqual(44)
    expect(sealBox.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height)
    expect(sealBox.x + sealBox.width).toBeGreaterThan(390 - 24)
    for (const t of await tabs.all()) await expectNoHorizontalOverflow(t)
  })

  test('HUD и док не вылезают после прогона симуляции', async ({ page }) => {
    await page.goto('/?seed=3&test=1')
    await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), 300)
    await expectNoHorizontalOverflow(page.getByRole('banner'))
    await expectNoHorizontalOverflow(
      page.getByRole('navigation', { name: 'Разделы' }).locator('..'),
    )
  })
})
