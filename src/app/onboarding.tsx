// Обучение в песочнице (docs/spec.md §12): отдельная лаборатория в памяти с фиксированным seed.
// Провайдер и хуки — один модуль по контракту; fast refresh этого файла даёт полную перезагрузку
/* oxlint-disable react/only-export-components */
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { factOf, type Fact } from '../ui/onboarding/tour'
import { LabStoreProvider } from './hooks'
import { startSimulation, type SimulationEnv } from './simulation'
import { createLabStore, type LabStore, type Speed } from './store'

// Флаг «обучение уже предлагали»: ставят «Пропустить», «Выйти» и финал
export const ONBOARDING_KEY = 'portal-lab-onboarding'

// Первый портал песочницы — ЗК-005-1 (Забытый Курган): 4 существа, риск средний (42), после
// стабилизации низкий (29) — все шаги обучения проходят
export const TOUR_SEED = 54

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>

// Сломанное хранилище не должно навязывать обучение при каждом входе: считаем, что уже видели
export function onboardingSeen(storage: FlagStorage): boolean {
  try {
    return storage.getItem(ONBOARDING_KEY) !== null
  } catch {
    return true
  }
}

function markSeen(storage: FlagStorage): void {
  try {
    storage.setItem(ONBOARDING_KEY, '1')
  } catch {
    // Не записали — предложим ещё раз; игре это не мешает
  }
}

// Хранилище песочницы: живёт, пока идёт обучение
function memoryStorage(): FlagStorage {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  }
}

export interface Onboarding {
  // Свиток-приглашение на экране
  offer: boolean
  // Идёт обучение: что уже сделано в песочнице
  tour: { facts: ReadonlySet<Fact> } | null
  start(): void
  skip(): void
  exit(): void
}

interface Session {
  id: number
  store: LabStore
  stop: () => void
  // Скорость настоящей лаборатории до обучения: вернём её на выходе
  speed: Speed
}

const OnboardingContext = createContext<Onboarding | null>(null)
const NO_FACTS: ReadonlySet<Fact> = new Set()

/**
 * Даёт приложению store: настоящий или, пока идёт обучение, песочницу. Смена store пересоздаёт
 * приложение (маршрут снова — зал). Настоящая лаборатория на время обучения стоит на паузе.
 */
export function OnboardingProvider(props: {
  store: LabStore
  storage: FlagStorage
  now: () => number
  offer: boolean
  // Цикл тиков для песочницы; без него (тесты) она не тикает
  simulation?: SimulationEnv
  children: ReactNode
}) {
  const { store, storage, now, simulation } = props
  const [offer, setOffer] = useState(props.offer)
  const [session, setSession] = useState<Session | null>(null)
  const [facts, setFacts] = useState<ReadonlySet<Fact>>(NO_FACTS)
  const sessionRef = useRef<Session | null>(null)
  const nextId = useRef(0)

  // Размонтирование посреди обучения: цикл песочницы не должен пережить приложение
  useEffect(() => () => sessionRef.current?.stop(), [])

  const value = useMemo<Onboarding>(() => {
    function start() {
      if (sessionRef.current) return
      const speed = store.getState().speed
      store.setSpeed(0)
      const inner = createLabStore({ storage: memoryStorage(), seed: TOUR_SEED, now })
      inner.setSpeed(0)
      const sandbox: LabStore = {
        ...inner,
        dispatch(command) {
          const result = inner.dispatch(command)
          const fact = factOf(command, result.rejection !== undefined)
          setFacts((prev) => (prev.has(fact) ? prev : new Set(prev).add(fact)))
          return result
        },
      }
      const stop = simulation ? startSimulation(sandbox, simulation) : () => {}
      const next = { id: ++nextId.current, store: sandbox, stop, speed }
      sessionRef.current = next
      setFacts(NO_FACTS)
      setOffer(false)
      setSession(next)
    }
    function skip() {
      markSeen(storage)
      setOffer(false)
    }
    function exit() {
      const current = sessionRef.current
      if (!current) return
      sessionRef.current = null
      current.stop()
      store.setSpeed(current.speed)
      markSeen(storage)
      setSession(null)
    }
    return { offer, tour: session ? { facts } : null, start, skip, exit }
  }, [store, storage, now, simulation, offer, session, facts])

  return (
    <OnboardingContext.Provider value={value}>
      <LabStoreProvider store={session?.store ?? store}>
        <Fragment key={session?.id ?? 'lab'}>{props.children}</Fragment>
      </LabStoreProvider>
    </OnboardingContext.Provider>
  )
}

// Обучение приложения; вне провайдера (тесты экранов) — null: ни приглашения, ни кнопки
export function useOnboarding(): Onboarding | null {
  return useContext(OnboardingContext)
}
