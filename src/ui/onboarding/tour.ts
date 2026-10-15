// Шаги обучения (docs/spec.md §12): что подсветить, что сказать и когда шаг засчитан.
// Чистый модуль: факты приходят от песочницы, маршрут — от навигации, видимость целей — от DOM.
import type { Route } from '../../app/navigation'
import type { Command } from '../../domain'
import type { AbilityCommand } from '../card/cardModel'

/** Что случилось в песочнице: команда и её исход. Факты только копятся. */
export type Fact = `${Command['type']}:${'ok' | 'refused'}`

export function factOf(command: Command, refused: boolean): Fact {
  return `${command.type}:${refused ? 'refused' : 'ok'}`
}

/** Цель подсказки — значение `data-tour` у элемента. */
export type TourTarget =
  | 'arch-empty'
  | 'arch-portal'
  | `ability-${AbilityCommand}`
  | 'scroll-ok'
  | 'card-close'
  | 'tab-hall'
  | 'tab-atlas'
  | 'tab-book'
  | 'tab-worklog'

export interface TourContext {
  facts: ReadonlySet<Fact>
  route: Route
}

export interface TourHint {
  // null — подсказка без цели: свиток посередине, без рамки
  target: TourTarget | null
  text: string
  when?: (ctx: TourContext) => boolean
}

export interface TourStep {
  id: string
  done: (ctx: TourContext) => boolean
  // По порядку: первая с видимой целью и выполненным when
  hints: readonly [TourHint, ...TourHint[]]
}

const had =
  (...facts: Fact[]) =>
  (ctx: TourContext) =>
    facts.some((fact) => ctx.facts.has(fact))

const onScreen =
  (...screens: Route['screen'][]) =>
  (ctx: TourContext) =>
    screens.includes(ctx.route.screen)

// Обратный путь к карточке портала: из зала — по арке, из другого раздела — через зал
const BACK_TO_CARD: readonly TourHint[] = [
  { target: 'card-close', text: 'Этот портал уже закрыт. Закройте карточку и откройте новый.' },
  { target: 'arch-portal', text: 'Вернитесь в карточку портала: кликните по нему.' },
  { target: 'arch-empty', text: 'Портал закрыт. Откройте новый в пустой арке.' },
  { target: 'tab-hall', text: 'Вернитесь в зал лаборатории.' },
]

const LEAVE_CARD: TourHint = { target: 'card-close', text: 'Сначала закройте карточку портала.' }

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'open',
    done: had('openPortal:ok'),
    hints: [
      {
        target: 'arch-empty',
        text: 'Это зал лаборатории: двенадцать арок под порталы. Кликните по пустой арке, и откроется портал в случайный мир.',
      },
      { target: 'tab-hall', text: 'Вернитесь в зал лаборатории.' },
    ],
  },
  {
    id: 'card',
    done: onScreen('portal'),
    hints: [
      {
        target: 'arch-portal',
        text: 'Портал открыт. На табличке под аркой его мир, риск и время до схлопывания. Кликните по порталу, чтобы открыть карточку.',
      },
      { target: 'tab-hall', text: 'Вернитесь в зал лаборатории.' },
    ],
  },
  {
    id: 'observer',
    done: had('sendObserver:ok'),
    hints: [
      {
        target: 'ability-sendObserver',
        text: 'В этом мире живут неизученные существа. Отправьте наблюдателя: он изучает их, а пока он внутри, портал теряет стабильность вдвое медленнее.',
      },
      ...BACK_TO_CARD,
    ],
  },
  {
    id: 'mark',
    done: had('toggleQuestioned:ok'),
    hints: [
      {
        target: 'scroll-ok',
        text: 'Заметку можно оставить пустой. Нажмите «Пометить».',
      },
      {
        target: 'ability-toggleQuestioned',
        text: 'Если портал вызывает сомнения, пометьте его «Под вопросом». На риск пометка не влияет, зато такие порталы легко найти фильтром в зале.',
      },
      ...BACK_TO_CARD,
    ],
  },
  {
    id: 'stabilize',
    done: had('stabilize:ok'),
    hints: [
      {
        target: 'ability-stabilize',
        text: 'Стабилизируйте портал: стабильность и время до схлопывания вырастут, энергия упадёт. Повторить можно только через 30 минут.',
      },
      ...BACK_TO_CARD,
    ],
  },
  {
    id: 'closeRefused',
    done: had('closePortal:refused', 'recallObservers:ok', 'closePortal:ok'),
    hints: [
      { target: 'ability-closePortal', text: 'Теперь попробуйте закрыть портал.' },
      ...BACK_TO_CARD,
    ],
  },
  {
    id: 'recall',
    done: had('recallObservers:ok', 'closePortal:ok'),
    hints: [
      {
        target: 'ability-recallObservers',
        when: had('closePortal:refused'),
        text: 'Отказ: портал нельзя закрыть, пока внутри наблюдатель. Недоступные действия приглушены, но нажимаются, и лаборатория объясняет причину. Отзовите наблюдателя.',
      },
      {
        target: 'ability-recallObservers',
        text: 'Отзовите наблюдателя: с ним внутри портал не закрыть.',
      },
      ...BACK_TO_CARD,
    ],
  },
  {
    id: 'close',
    done: had('closePortal:ok'),
    hints: [
      {
        target: 'scroll-ok',
        text: 'Существа этого мира остались неизученными, поэтому лаборатория переспрашивает. Нажмите «Закрыть всё равно».',
      },
      { target: 'ability-closePortal', text: 'Наблюдатель вернулся. Закройте портал.' },
      ...BACK_TO_CARD,
    ],
  },
  {
    id: 'leaveCard',
    done: (ctx) => !onScreen('portal')(ctx),
    hints: [
      {
        target: 'card-close',
        text: 'Портал закрыт, и его карточка теперь только для чтения. Закройте её.',
      },
    ],
  },
  {
    id: 'atlas',
    done: onScreen('atlas', 'world'),
    hints: [
      {
        target: 'tab-atlas',
        text: 'Все миры, где вы побывали, собраны в атласе: сколько существ изучено и сколько раз туда открывали порталы. Откройте атлас.',
      },
      LEAVE_CARD,
    ],
  },
  {
    id: 'journal',
    done: onScreen('journal'),
    hints: [
      {
        target: 'tab-book',
        text: 'В книге журнала записано всё, что случилось: ваши действия, отказы и события лаборатории. Загляните в неё.',
      },
      LEAVE_CARD,
    ],
  },
  {
    id: 'worklog',
    done: onScreen('worklog'),
    hints: [
      {
        target: 'tab-worklog',
        text: 'AI Worklog рассказывает, как эта игра делалась вместе с AI: инструменты, время, ошибки. Откройте его.',
      },
      LEAVE_CARD,
    ],
  },
  {
    id: 'done',
    done: () => false,
    hints: [
      {
        target: null,
        text: 'Обучение пройдено. Ваша лаборатория всё это время стояла на паузе, можно возвращаться.',
      },
    ],
  },
]

/** Следующий незасчитанный шаг начиная с index: индекс только растёт. */
export function advanceStep(index: number, ctx: TourContext): number {
  let next = index
  while (next < TOUR_STEPS.length - 1 && stepAt(next).done(ctx)) next++
  return next
}

export function stepAt(index: number): TourStep {
  const step = TOUR_STEPS[index]
  if (!step) throw new RangeError(`Нет шага обучения ${index}`)
  return step
}

/** Подсказка шага: первая подходящая с видимой целью; если видимых нет — первая подходящая. */
export function pickHint(
  step: TourStep,
  ctx: TourContext,
  visible: (target: TourTarget) => boolean,
): TourHint {
  const fits = step.hints.filter((hint) => hint.when?.(ctx) ?? true)
  const found = fits.find((hint) => hint.target === null || visible(hint.target))
  return found ?? fits[0] ?? step.hints[0]
}
