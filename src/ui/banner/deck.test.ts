import { describe, expect, it } from 'vitest'
import { DECK_GAP, DECK_SPINE, DECK_SPINES, deckLayout } from './deck'

describe('deckLayout', () => {
  it('пустая стопка — нулевой высоты', () => {
    expect(deckLayout([], false)).toEqual({ places: [], height: 0 })
    expect(deckLayout([], true)).toEqual({ places: [], height: 0 })
  })

  it('сложенная колода: новейший целиком, нижние края предыдущих выступают на корешок', () => {
    const { places, height } = deckLayout([84, 84, 96], false)
    expect(places[0]).toEqual({ y: 0, scale: 1, brightness: 1, hidden: false })
    // Нижний край слоя d — на d корешков ниже новейшего, независимо от высоты баннера
    expect(places[1]!.y + 84).toBe(84 + DECK_SPINE)
    expect(places[2]!.y + 96).toBe(84 + 2 * DECK_SPINE)
    expect(places[1]!.scale).toBeLessThan(1)
    expect(places[2]!.scale).toBeLessThan(places[1]!.scale)
    expect(places[2]!.brightness).toBeLessThan(places[1]!.brightness)
    expect(height).toBe(84 + 2 * DECK_SPINE)
  })

  it('баннер ниже новейшего не вылезает над колодой', () => {
    const { places } = deckLayout([84, 140], false)
    expect(places[1]!.y).toBe(0)
  })

  it(`видно ${DECK_SPINES} корешка, глубже — под ними и скрыты`, () => {
    const { places, height } = deckLayout([84, 84, 84, 84, 84], false)
    expect(places.map((p) => p.hidden)).toEqual([false, false, false, false, true])
    expect(places[4]!.y).toBe(places[3]!.y)
    expect(height).toBe(84 + DECK_SPINES * DECK_SPINE)
  })

  it('раскрытая колода — столбец с зазором 12 px без масштаба и затемнения', () => {
    const { places, height } = deckLayout([84, 104, 84], true)
    expect(places.map((p) => p.y)).toEqual([0, 84 + DECK_GAP, 84 + 104 + 2 * DECK_GAP])
    for (const p of places) expect(p).toMatchObject({ scale: 1, brightness: 1, hidden: false })
    expect(height).toBe(84 + 104 + 84 + 2 * DECK_GAP)
    expect(DECK_GAP).toBe(12)
  })
})
