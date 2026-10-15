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

/**
 * Элемент и все его потомки целиком внутри окна по горизонтали (по рамкам, а не по scrollWidth:
 * валики свитка нарочно шире пергамента). Блоки в 1 px — текст для скринридера.
 */
async function expectInsideViewport(target: Locator): Promise<void> {
  const inner = target.page().viewportSize()!.width
  const outside = await target.evaluate((root, width) => {
    return [root, ...root.querySelectorAll('*')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 1 && (r.left < -0.5 || r.right > width + 0.5))
      .map(({ el, r }) => `${el.tagName.toLowerCase()}.${el.className} ${r.left}…${r.right}`)
  }, inner)
  expect(outside, 'вылезает за окно').toEqual([])
}

// Пересекаются ли рамки двух элементов
function intersects(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

// Критический портал в арке 1 и его карточка через записку «Тревожных знаков»
async function openCriticalCard(page: Page): Promise<Locator> {
  await page.goto('/?seed=3&test=1')
  await page.getByRole('button', { name: 'Арка 1 пуста — открыть портал' }).click()
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), 50)
  await page.getByRole('region', { name: 'Тревожные знаки' }).getByRole('button').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

// Затемнение карточки — родитель её диалога
const cardOverlay = (page: Page) => page.getByTestId('card-overlay')

test.describe('узкий экран, 390×844: карточка, свитки, баннеры', () => {
  test.use({ viewport: NARROW })

  test('карточка портала по ширине окна: крестик над ней и в окне, способности в окне', async ({
    page,
  }) => {
    const card = await openCriticalCard(page)
    await expectNoHorizontalOverflow(page)
    await expectNoHorizontalOverflow(cardOverlay(page))
    await expectInsideViewport(card)

    const close = page.getByRole('button', { name: 'Закрыть карточку' })
    const closeBox = (await close.boundingBox())!
    expect(closeBox.width).toBeGreaterThanOrEqual(44)
    expect(closeBox.height).toBeGreaterThanOrEqual(44)
    expect(closeBox.y).toBeGreaterThanOrEqual(0)
    // Над правым верхним углом карточки, а не слева от неё
    const heading = (await card.getByRole('heading', { level: 2 }).first().boundingBox())!
    expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(heading.y)

    const abilities = card.getByRole('group', { name: 'Способности' })
    await expectInsideViewport(abilities)
    for (const button of await abilities.getByRole('button').all()) {
      await expectNoHorizontalOverflow(button)
    }

    await close.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('свиток «Закрыть последний портал» помещается в окне', async ({ page }) => {
    const card = await openCriticalCard(page)
    await card
      .getByRole('group', { name: 'Способности' })
      .getByRole('button', { name: 'Закрыть', exact: true })
      .click()
    const scroll = page.getByRole('dialog', { name: 'ЗАКРЫТЬ ПОСЛЕДНИЙ ПОРТАЛ?' })
    await expect(scroll).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectInsideViewport(page.getByTestId('scroll-backdrop'))
    // Столбец свитка — 100vw − 32 px
    expect((await scroll.boundingBox())!.width).toBeCloseTo(NARROW.width - 32, 0)
  })

  test('свиток «Под вопросом» помещается в окне', async ({ page }) => {
    const card = await openCriticalCard(page)
    await card
      .getByRole('group', { name: 'Способности' })
      .getByRole('button', { name: 'Под вопросом' })
      .click()
    await expect(page.getByRole('dialog', { name: 'ПОМЕТИТЬ «ПОД ВОПРОСОМ»' })).toBeVisible()
    // Поле заметки в фокусе и с видимым контуром (общее :focus-visible свитка, не инлайн none)
    const field = page.getByRole('textbox', { name: /Заметка/ })
    await expect(field).toBeFocused()
    await expect(field).toHaveCSS('outline-style', 'solid')
    await expect(field).toHaveCSS('outline-width', '3px')
    await expectNoHorizontalOverflow(page)
    await expectInsideViewport(page.getByTestId('scroll-backdrop'))
  })

  test('свиток печати помещается в окне', async ({ page }) => {
    await page.goto('/?seed=3&test=1')
    await page.getByRole('button', { name: 'Запечатать лабораторию' }).click()
    await expect(page.getByRole('dialog', { name: 'ЗАПЕЧАТАТЬ ЛАБОРАТОРИЮ?' })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectInsideViewport(page.getByTestId('scroll-backdrop'))
  })

  test('баннеры с карточкой: колода во всю ширину у нижнего края, не закрывает крестик', async ({
    page,
  }) => {
    // Без въезда справа: меряем баннеры на месте
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const card = await openCriticalCard(page)
    const abilities = card.getByRole('group', { name: 'Способности' })
    const send = abilities.getByRole('button', { name: 'Отправить наблюдателя' })
    await send.focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press('Enter')
    // Курсор не над колодой: она сложена
    await page.mouse.move(0, 0)
    const banners = page.getByRole('alert')
    await expect(banners).toHaveCount(3)
    const stack = page.locator('.banner-stack')
    await expect(stack).not.toHaveAttribute('data-open')
    const boxes = await Promise.all(
      (await banners.all()).map(async (b) => (await b.boundingBox())!),
    )
    // Новейший сверху колоды во всю ширину, предыдущие под ним уже и выступают снизу корешками
    const [newest, ...older] = boxes
    expect(newest!.x).toBeCloseTo(8, 0)
    expect(newest!.width).toBeCloseTo(NARROW.width - 16, 0)
    for (const box of older) {
      expect(box.width).toBeLessThan(newest!.width)
      expect(box.y + box.height).toBeGreaterThan(newest!.y + newest!.height)
    }
    // Колода прижата к низу окна (дока под затемнением нет), 8 px отступа
    const deck = (await stack.boundingBox())!
    expect(deck.y + deck.height).toBeCloseTo(NARROW.height - 8, 0)
    await expectNoHorizontalOverflow(stack)
    const hide = (await banners
      .first()
      .getByRole('button', { name: 'Скрыть уведомление' })
      .boundingBox())!
    expect(hide.width).toBeGreaterThanOrEqual(44)
    expect(hide.height).toBeGreaterThanOrEqual(44)
    expect(hide.x + hide.width).toBeLessThanOrEqual(NARROW.width)
    // Крестик «закрыть карточку» не под колодой
    const closeBox = (await page.getByRole('button', { name: 'Закрыть карточку' }).boundingBox())!
    expect(intersects(closeBox, deck), 'колода закрывает крестик').toBe(false)
  })

  test('баннеры без карточки: колода над доком, не закрывает скорость и паузу', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/?seed=3&test=1')
    // Повторные «Нанять» при идущем найме — отказ за отказом
    const hire = page.getByRole('button', { name: /Нанять/ })
    await hire.click()
    await hire.focus()
    for (let i = 0; i < 4; i++) await page.keyboard.press('Enter')
    await page.mouse.move(0, 0)
    await expect(page.getByRole('alert')).toHaveCount(4)
    const stack = page.locator('.banner-stack')
    await expect(stack).not.toHaveAttribute('data-open')
    const deck = (await stack.boundingBox())!

    // Колода над доком: нижний край на 84 px выше низа окна (76 px дока + 8)
    expect(deck.y + deck.height).toBeCloseTo(NARROW.height - 84, 0)
    const dockBox = (await dock(page).boundingBox())!
    expect(deck.y + deck.height).toBeLessThanOrEqual(dockBox.y)

    // Страница наверху: кнопки скорости и паузы HUD видны, колода на них не заходит
    await page.evaluate(() =>
      (globalThis as unknown as { scrollTo(x: number, y: number): void }).scrollTo(0, 0),
    )
    const speed = await page.getByRole('button', { name: /^(Пауза|Скорость ×)/ }).all()
    expect(speed.length).toBeGreaterThan(1)
    for (const button of speed) {
      const box = (await button.boundingBox())!
      expect(intersects(box, deck), 'колода закрывает скорость').toBe(false)
    }
  })
})

// Четыре портала и 400 тиков: в атласе четыре мира, в журнале два разворота
async function playedLab(page: Page): Promise<void> {
  await page.goto('/?seed=3&test=1')
  await openPortals(page, 4)
  await page.evaluate((n) => (globalThis as LabGlobal).__lab!.advance(n), 400)
}

// Рамки по порядку: каждая следующая не выше конца предыдущей
async function expectColumn(items: Locator): Promise<void> {
  const boxes = await items.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom }
    }),
  )
  expect(boxes.length).toBeGreaterThan(1)
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i]!.top, `${i + 1}-й ниже ${i}-го`).toBeGreaterThanOrEqual(boxes[i - 1]!.bottom)
  }
}

test.describe('узкий экран, 390×844: атлас, страница мира, журнал', () => {
  test.use({ viewport: NARROW })

  test('атлас: карточки миров столбцом, без горизонтальной прокрутки', async ({ page }) => {
    await playedLab(page)
    await page.getByRole('link', { name: 'Атлас миров' }).click()
    const cards = page.getByRole('main').getByRole('article')
    await expect(cards).toHaveCount(4)
    await expectNoHorizontalOverflow(page)
    await expectNoHorizontalOverflow(page.getByRole('main'))
    await expectColumn(cards)
    for (const tab of await page.getByRole('main').getByRole('button').all()) {
      expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
  })

  test('страница мира: страницы книги и существа столбцом, без горизонтальной прокрутки', async ({
    page,
  }) => {
    await playedLab(page)
    await page.getByRole('link', { name: 'Атлас миров' }).click()
    await page.getByRole('link', { name: 'Страница мира →' }).first().click()
    const creatures = page.getByRole('list', { name: 'Существа мира' })
    await expect(creatures).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await expectNoHorizontalOverflow(page.getByRole('main'))
    await expectColumn(creatures.getByRole('listitem'))
    await expectColumn(page.getByRole('main').locator('section'))
  })

  test('журнал: страницы разворота одна под другой, закладки в окне', async ({ page }) => {
    await playedLab(page)
    await page.getByRole('link', { name: 'Книга журнала' }).click()
    await expect(page.getByRole('list', { name: /^Страница \d+$/ })).toHaveCount(2)
    await expectNoHorizontalOverflow(page)
    await expectNoHorizontalOverflow(page.getByRole('main'))
    await expectColumn(page.getByRole('main').locator('section'))
    // Список значений закладки раскрывается в окне
    await page.getByRole('button', { name: /Вид записи/ }).click()
    await expect(page.getByRole('button', { name: 'отказ' })).toBeVisible()
    await expectInsideViewport(page.getByRole('main'))
  })
})

test('на ширине 1180…1211 и 1440 крестик карточки целиком в окне; на 1440 карточка 300…900', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const card = await openCriticalCard(page)
  const close = page.getByRole('button', { name: 'Закрыть карточку' })
  const cardBox = (await card.boundingBox())!
  expect(cardBox.x).toBeCloseTo(300, 0)
  expect(cardBox.x + cardBox.width).toBeCloseTo(900, 0)
  for (const width of [1440, 1211, 1200, 1195, 1185, 1180, 1000, 901]) {
    await page.setViewportSize({ width, height: 1000 })
    const box = (await close.boundingBox())!
    expect(box.x, `крестик левее окна на ${width}`).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
  }
})
