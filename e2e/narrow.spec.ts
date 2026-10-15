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
    // Элементы, содержимое которых шире самих себя (текст, вылезающий из кнопки, и т. п.);
    // блоки в 1 px — текст только для скринридера, он нарочно не помещается
    const bad = [root, ...root.querySelectorAll('*')]
      .filter((el) => el.scrollWidth > el.clientWidth && el.clientWidth > 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
    return { box: { left: rect.left, right: rect.right }, overflowing: bad }
  })
  expect(box.left, 'левый край левее окна').toBeGreaterThanOrEqual(0)
  expect(box.right, 'правый край правее окна').toBeLessThanOrEqual(inner)
  expect(overflowing, 'содержимое шире своего блока').toEqual([])
}

// Док — родитель навигации по разделам
const dock = (page: Page) => page.getByRole('navigation', { name: 'Разделы' }).locator('..')

test.describe('узкий экран, 390×844: HUD и док', () => {
  test.use({ viewport: NARROW })

  test('HUD и док видны и помещаются по ширине', async ({ page }) => {
    await page.goto('/?seed=3&test=1')
    const hud = page.getByRole('banner')
    await expect(hud).toBeVisible()
    await expect(dock(page)).toBeVisible()
    await expectNoHorizontalOverflow(hud)
    await expectNoHorizontalOverflow(dock(page))
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
    // «Нанять» остаётся доступной: целиком внутри окна по горизонтали
    const hire = hud.getByRole('button', { name: 'Нанять' })
    await expect(hire).toBeVisible()
    const hireBox = (await hire.boundingBox())!
    expect(hireBox.x).toBeGreaterThanOrEqual(0)
    expect(hireBox.x + hireBox.width).toBeLessThanOrEqual(NARROW.width)
  })

  test('HUD на узкой ширине прокручивается вместе со страницей, а не залипает', async ({
    page,
  }) => {
    await page.goto('/?seed=3&test=1')
    const hud = page.getByRole('banner')
    expect((await hud.boundingBox())!.y).toBe(0)
    await page.mouse.move(NARROW.width / 2, NARROW.height / 2)
    await page.mouse.wheel(0, 400)
    // Страница должна действительно прокрутиться, иначе проверка пуста
    await expect.poll(async () => (await hud.boundingBox())!.y).toBeLessThan(0)
    // Док при этом остаётся у нижнего края
    const dockBox = (await dock(page).boundingBox())!
    expect(dockBox.y + dockBox.height).toBeCloseTo(NARROW.height, 0)
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

  test('в доке один ряд ≤ 76 px: три вкладки поровну и значок печати 44×44 в конце', async ({
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
    await expect(seal).toHaveAttribute('title', 'Запечатать лабораторию')
    const sealBox = (await seal.boundingBox())!
    expect(sealBox.width).toBeGreaterThanOrEqual(44)
    expect(sealBox.height).toBeGreaterThanOrEqual(44)
    // В том же ряду, правее последней вкладки, и целиком в окне
    expect(sealBox.x).toBeGreaterThanOrEqual(boxes[2]!.x + boxes[2]!.width)
    expect(sealBox.y).toBeLessThan(boxes[0]!.y + boxes[0]!.height)
    expect(sealBox.x + sealBox.width).toBeLessThanOrEqual(NARROW.width)
    expect((await dock(page).boundingBox())!.height).toBeLessThanOrEqual(76)
    for (const t of await tabs.all()) await expectNoHorizontalOverflow(t)
  })

  test('в альбомной ориентации 844×390 док виден и не выше 76 px', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/?seed=3&test=1')
    await expect(dock(page)).toBeVisible()
    const box = (await dock(page).boundingBox())!
    expect(box.height).toBeLessThanOrEqual(76)
    expect(box.y + box.height).toBeCloseTo(390, 0)
    await expectNoHorizontalOverflow(dock(page))
  })

  test('HUD и док не вылезают после прогона симуляции', async ({ page }) => {
    await page.goto('/?seed=3&test=1')
    await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), 300)
    await expectNoHorizontalOverflow(page.getByRole('banner'))
    await expectNoHorizontalOverflow(dock(page))
  })
})

// Ячейки зала по порядку арок и их рамки
const hallCells = (page: Page) => page.getByRole('main').locator('.hall-cell')
const emptyArch = (page: Page) =>
  page.getByRole('button', { name: /^Арка \d+ пуста — открыть портал$/ }).first()

async function openPortals(page: Page, n: number): Promise<void> {
  for (let i = 0; i < n; i++) await emptyArch(page).click()
}

// Каждая следующая ячейка начинается не выше конца предыдущей: список, а не сетка
async function expectStacked(page: Page): Promise<void> {
  const cells = hallCells(page)
  await expect(cells).toHaveCount(12)
  const boxes = await cells.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom }
    }),
  )
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i]!.top, `арка ${i + 1} ниже арки ${i}`).toBeGreaterThanOrEqual(
      boxes[i - 1]!.bottom,
    )
  }
}

test.describe('узкий экран, 390×844: зал списком карточек', () => {
  test.use({ viewport: NARROW })

  test('пустой зал: без горизонтальной прокрутки, приглашение и подсказка первой арки видны', async ({
    page,
  }) => {
    await page.goto('/?seed=3&test=1')
    await expectNoHorizontalOverflow(page)
    await expectStacked(page)
    await expect(page.getByText('Порталов нет — активируйте первую арку')).toBeVisible()
    const hint = page.getByText('нажмите — откроется портал')
    await expect(hint).toBeVisible()
    const box = (await hint.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(NARROW.width)
    // Факелы на узкой ширине убраны
    await expect(page.locator('.hall-flame').first()).toBeHidden()
  })

  test('пустая арка — низкая строка; нажатие по подписи открывает портал', async ({ page }) => {
    await page.goto('/?seed=3&test=1')
    const row = hallCells(page).nth(1)
    const rowBox = (await row.boundingBox())!
    expect(rowBox.height).toBeGreaterThanOrEqual(44)
    expect(rowBox.height).toBeLessThanOrEqual(64)
    // Подпись «АРКА 2» не внутри кнопки, но строка нажимается целиком
    const label = (await row.getByText('АРКА 2').boundingBox())!
    await page.mouse.click(label.x + label.width / 2, label.y + label.height / 2)
    // Портал встаёт в первую свободную арку, как и при нажатии на саму арку
    await expect(page.getByRole('button', { name: /^Открыть карточку портала/ })).toHaveCount(1)
  })

  test('три портала: карточки стопкой, табличка справа от арки и целиком в окне', async ({
    page,
  }) => {
    await page.goto('/?seed=3&test=1')
    await openPortals(page, 3)
    await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), 40)
    await expectNoHorizontalOverflow(page)
    await expectStacked(page)
    const arches = page.getByRole('button', { name: /^Открыть карточку портала/ })
    await expect(arches).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      const cell = hallCells(page).nth(i)
      const plate = cell.locator('.hall-plate')
      const plateBox = (await plate.boundingBox())!
      expect(plateBox.x, 'табличка левее окна').toBeGreaterThanOrEqual(0)
      expect(plateBox.x + plateBox.width, 'табличка правее окна').toBeLessThanOrEqual(NARROW.width)
      const archBox = (await arches.nth(i).boundingBox())!
      expect(plateBox.x).toBeGreaterThanOrEqual(archBox.x + archBox.width)
      expect(plateBox.y).toBeLessThan(archBox.y + archBox.height)
      await expectNoHorizontalOverflow(plate)
    }
    // Записки «Тревожных знаков» — столбцом на всю ширину
    const notes = page.getByRole('region', { name: 'Тревожные знаки' }).getByRole('button')
    const noteBoxes = await Promise.all(
      (await notes.all()).map(async (n) => (await n.boundingBox())!),
    )
    expect(noteBoxes.length).toBeGreaterThan(1)
    for (let i = 1; i < noteBoxes.length; i++) {
      expect(noteBoxes[i]!.y).toBeGreaterThanOrEqual(noteBoxes[i - 1]!.y + noteBoxes[i - 1]!.height)
    }
  })

  test('все 12 арок заняты: без горизонтальной прокрутки, плашка целиком видна', async ({
    page,
  }) => {
    await page.goto('/?seed=3&test=1')
    await openPortals(page, 12)
    await expect(page.getByRole('button', { name: /^Открыть карточку портала/ })).toHaveCount(12)
    await expectNoHorizontalOverflow(page)
    await expectStacked(page)
    await expectNoHorizontalOverflow(
      page.getByText('Все 12 арок заняты — открыть новый портал некуда'),
    )
  })
})

test('на 1440×1000 зал остаётся сеткой 6×2', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/?seed=3&test=1')
  const tops = await hallCells(page).evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().top)),
  )
  expect(new Set(tops.slice(0, 6)).size).toBe(1)
  expect(new Set(tops.slice(6)).size).toBe(1)
  expect(tops[6]).toBeGreaterThan(tops[0]!)
})
