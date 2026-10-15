// Раскладка стопки баннеров колодой. Чистая функция от высот: места задаются transform-ом, и переходы
// между ними (сложить, раскрыть, сдвинуть соседей на место ушедшего) анимирует CSS.

// Корешок предыдущего баннера выступает на 8 px, каждый слой уже на 4 % и темнее на 20 %; видно три
// корешка, остальные лежат под ними. Раскрытая колода — столбец с зазором 12 px (канвас 16-banners)
export const DECK_SPINE = 8
export const DECK_SPINES = 3
const DECK_SHRINK = 0.04
const DECK_DIM = 0.2
export const DECK_GAP = 12

/** Место баннера в колоде: сдвиг вниз, масштаб от нижнего края, яркость, скрыт ли под корешками. */
export interface DeckPlace {
  y: number
  scale: number
  brightness: number
  hidden: boolean
}

/**
 * Места баннеров по их высотам, новейший первым. Сложенная колода: новейший сверху целиком, у
 * предыдущих нижний край выступает из-под него на DECK_SPINE за каждый слой (масштаб от нижнего края,
 * так что корешок не зависит от высоты баннера). Раскрытая — столбец с зазором DECK_GAP.
 * height — высота самой стопки: по ней ловится курсор.
 */
export function deckLayout(
  heights: readonly number[],
  open: boolean,
): { places: DeckPlace[]; height: number } {
  if (open) {
    let y = 0
    const places = heights.map((h) => {
      const place = { y, scale: 1, brightness: 1, hidden: false }
      y += h + DECK_GAP
      return place
    })
    return { places, height: Math.max(0, y - DECK_GAP) }
  }
  const top = heights[0] ?? 0
  const places = heights.map((h, depth) => {
    const level = Math.min(depth, DECK_SPINES)
    return {
      y: Math.max(0, top + level * DECK_SPINE - h),
      scale: 1 - level * DECK_SHRINK,
      brightness: 1 - level * DECK_DIM,
      hidden: depth > DECK_SPINES,
    }
  })
  const spines = Math.min(Math.max(heights.length - 1, 0), DECK_SPINES)
  return { places, height: heights.length ? top + spines * DECK_SPINE : 0 }
}
