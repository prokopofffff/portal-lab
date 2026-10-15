import { expect, test, type Page } from '@playwright/test'
import { expectNoHorizontalOverflow } from './overflow.ts'

// Запускается в проекте chromium-scrollbars: полоса прокрутки окна занимает место (15 px), и
// раскладка, рассчитанная на 100vw, вылезла бы на её ширину

type LabGlobal = { __lab?: { advance(ticks: number): void } }
// В e2e нет типов DOM (tsconfig.node): нужные поля окна описаны здесь
type Win = {
  innerWidth: number
  document: { documentElement: { scrollWidth: number; clientWidth: number } }
}

async function playedLab(page: Page): Promise<void> {
  await page.goto('/?seed=3&test=1')
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole('button', { name: /^Открыть портал в арке/ })
      .first()
      .click()
  }
  await page.evaluate(() => (globalThis as LabGlobal).__lab!.advance(120))
}

// 901 px не проверяем: HUD там шире окна и без полосы (lab-xvp)
for (const width of [1440, 1280, 1100, 1000, 390]) {
  test(`с классической полосой прокрутки на ${width} px нет горизонтальной прокрутки`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 700 })
    await playedLab(page)
    // Полоса прокрутки действительно занимает место
    const scrollbar = await page.evaluate(() => {
      const win = globalThis as unknown as Win
      return win.innerWidth - win.document.documentElement.clientWidth
    })
    expect(scrollbar).toBeGreaterThan(0)

    const noOverflow = async () => {
      const sizes = await page.evaluate(() => {
        const root = (globalThis as unknown as Win).document.documentElement
        return { scroll: root.scrollWidth, client: root.clientWidth }
      })
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client)
    }

    await noOverflow()
    await page.getByRole('link', { name: 'Атлас миров' }).click()
    await noOverflow()
    await page.getByRole('link', { name: 'Страница мира →' }).first().click()
    await noOverflow()
    await page.getByRole('link', { name: 'Книга журнала' }).click()
    await noOverflow()

    await page.getByRole('link', { name: 'Зал лаборатории' }).click()
    await page
      .getByRole('button', { name: /^Открыть карточку портала/ })
      .first()
      .click()
    await noOverflow()
    await expectNoHorizontalOverflow(page.getByTestId('card-overlay'))
  })
}
