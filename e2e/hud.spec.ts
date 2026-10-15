import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow } from './overflow.ts'

type LabGlobal = { __lab?: { advance(ticks: number): void } }

// Десктоп по брифу — от 1280 px; канвас нарисован на 1440
for (const width of [1280, 1366, 1440]) {
  test(`HUD на ${width} px: подписи и числа в одну строку, ничего не налезает`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/?seed=3&test=1')
    // Время в четыре цифры — часы шире, чем в канвасе
    await page.evaluate(() => (globalThis as LabGlobal).__lab!.advance(1500))
    await expect(page.getByText('мин 1500', { exact: true })).toBeVisible()

    const hud = page.getByRole('banner')
    await expectNoHorizontalOverflow(hud)

    // Каждая подпись и каждое значение счётчика — одна строка
    const lines = await hud
      .locator('.hud-stat dt, .hud-stat dd')
      .evaluateAll((els) =>
        els.map((el) => ({ text: el.textContent, height: el.getBoundingClientRect().height })),
      )
    expect(lines).toHaveLength(12)
    for (const { text, height } of lines) expect(height, text!).toBeLessThan(16)

    // Блоки HUD идут слева направо без наложений, счётчики не заходят за правый отступ
    const boxes = await hud.evaluate((root) =>
      [...root.children].map((el) => {
        const r = el.getBoundingClientRect()
        return { left: r.left, right: r.right }
      }),
    )
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right - 0.5)
    }
    expect(boxes.at(-1)!.right).toBeLessThanOrEqual(width - 12)
  })
}

test('док на 901…1440 px: печать не налезает на вкладки, «Книга журнала» нажимается', async ({
  page,
}) => {
  await page.goto('/?seed=3&test=1')
  const tabs = page.getByRole('navigation', { name: 'Разделы' })
  const seal = page.getByRole('button', { name: 'Запечатать лабораторию' })
  for (const width of [1440, 1280, 1259, 1211, 1100, 1040, 1039, 1000, 901]) {
    await page.setViewportSize({ width, height: 800 })
    const t = (await tabs.boundingBox())!
    const s = (await seal.boundingBox())!
    expect(s.x, `печать на ${width} налезает на вкладки`).toBeGreaterThanOrEqual(t.x + t.width)
    expect(s.x + s.width).toBeLessThanOrEqual(width)
    expect(s.height).toBeGreaterThanOrEqual(36)
  }
  await page.getByRole('link', { name: 'Книга журнала' }).click()
  await expect(page.getByRole('heading', { name: 'КНИГА ЖУРНАЛА' })).toBeVisible()
})
