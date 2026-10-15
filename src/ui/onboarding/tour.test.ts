import { describe, expect, it } from 'vitest'
import type { Route } from '../../app/navigation'
import {
  advanceStep,
  factOf,
  pickHint,
  TOUR_STEPS,
  type Fact,
  type TourContext,
  type TourTarget,
} from './tour'

const HALL: Route = { screen: 'hall' }
const CARD: Route = { screen: 'portal', portal: 'ЗК-005-1' }

function ctx(facts: Fact[], route: Route = HALL): TourContext {
  return { facts: new Set(facts), route }
}

const id = (index: number) => TOUR_STEPS[index]?.id

describe('факты обучения', () => {
  it('команда и исход', () => {
    expect(factOf({ type: 'openPortal' }, false)).toBe('openPortal:ok')
    expect(factOf({ type: 'closePortal', portal: 'X' }, true)).toBe('closePortal:refused')
  })
})

describe('advanceStep', () => {
  it('тринадцать шагов, последний — финал', () => {
    expect(TOUR_STEPS).toHaveLength(13)
    expect(id(12)).toBe('done')
  })

  it('без фактов стоит на первом шаге', () => {
    expect(advanceStep(0, ctx([]))).toBe(0)
  })

  it('основной сценарий проходит шаг за шагом', () => {
    const facts: Fact[] = []
    let index = 0
    const go = (route: Route, ...add: Fact[]) => {
      facts.push(...add)
      index = advanceStep(index, ctx(facts, route))
      return id(index)
    }
    expect(go(HALL, 'openPortal:ok')).toBe('card')
    expect(go(CARD)).toBe('observer')
    expect(go(CARD, 'sendObserver:ok')).toBe('mark')
    expect(go(CARD, 'toggleQuestioned:ok')).toBe('stabilize')
    expect(go(CARD, 'stabilize:ok')).toBe('closeRefused')
    expect(go(CARD, 'closePortal:refused')).toBe('recall')
    expect(go(CARD, 'recallObservers:ok')).toBe('close')
    expect(go(CARD, 'closePortal:ok')).toBe('leaveCard')
    expect(go(HALL)).toBe('atlas')
    expect(go({ screen: 'atlas' })).toBe('journal')
    expect(go({ screen: 'journal' })).toBe('worklog')
    expect(go({ screen: 'worklog' })).toBe('done')
    // Финал засчитывается только кнопкой
    expect(go(HALL)).toBe('done')
  })

  it('шаг «карточка» не откатывается, когда карточку закрыли', () => {
    const at = advanceStep(0, ctx(['openPortal:ok'], CARD))
    expect(id(at)).toBe('observer')
    expect(advanceStep(at, ctx(['openPortal:ok'], HALL))).toBe(at)
  })

  it('действие, сделанное раньше своего шага, засчитывается, когда до него дошли', () => {
    const facts: Fact[] = ['openPortal:ok', 'stabilize:ok', 'sendObserver:ok']
    const at = advanceStep(0, ctx(facts, CARD))
    expect(id(at)).toBe('mark')
    expect(id(advanceStep(at, ctx([...facts, 'toggleQuestioned:ok'], CARD)))).toBe('closeRefused')
  })

  it('отзыв без отказа пропускает урок отказа', () => {
    const facts: Fact[] = [
      'openPortal:ok',
      'sendObserver:ok',
      'toggleQuestioned:ok',
      'stabilize:ok',
      'recallObservers:ok',
    ]
    expect(id(advanceStep(0, ctx(facts, CARD)))).toBe('close')
  })

  it('страница мира засчитывает атлас', () => {
    const at = TOUR_STEPS.findIndex((step) => step.id === 'atlas')
    expect(id(advanceStep(at, ctx([], { screen: 'world', world: 'Забытый Курган' })))).toBe(
      'journal',
    )
  })

  it('индекс за концом не уходит', () => {
    expect(advanceStep(12, ctx([]))).toBe(12)
  })
})

describe('pickHint', () => {
  const step = (name: string) => TOUR_STEPS.find((s) => s.id === name)!
  const only =
    (...targets: TourTarget[]) =>
    (target: TourTarget) =>
      targets.includes(target)

  it('берёт первую подсказку с видимой целью', () => {
    expect(
      pickHint(step('observer'), ctx([]), only('ability-sendObserver', 'card-close')),
    ).toMatchObject({
      target: 'ability-sendObserver',
    })
  })

  it('карточка закрыта — ведёт обратно к порталу', () => {
    const hint = pickHint(step('observer'), ctx([]), only('arch-portal', 'arch-empty'))
    expect(hint.target).toBe('arch-portal')
    expect(hint.text).toMatch(/карточку портала/)
  })

  it('не в зале — ведёт в зал', () => {
    expect(pickHint(step('open'), ctx([]), only('tab-hall', 'tab-atlas')).target).toBe('tab-hall')
  })

  it('пометка: открыт свиток заметки — подсказка про «Пометить»', () => {
    const hint = pickHint(step('mark'), ctx([]), only('scroll-ok'))
    expect(hint.text).toMatch(/«Пометить»/)
  })

  it('отзыв после отказа объясняет отказ', () => {
    const visible = only('ability-recallObservers')
    expect(pickHint(step('recall'), ctx(['closePortal:refused']), visible).text).toMatch(/^Отказ/)
    expect(pickHint(step('recall'), ctx([]), visible).text).not.toMatch(/^Отказ/)
  })

  it('ни одной цели — последняя подсказка без цели или первая', () => {
    expect(pickHint(step('done'), ctx([]), only()).target).toBeNull()
    expect(pickHint(step('observer'), ctx([]), only()).target).toBe('ability-sendObserver')
  })
})
