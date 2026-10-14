// Часы симуляции: кадры анимации превращают реальное время в тики (docs/spec.md §2.3, прил. B)
import { CONFIG } from '../domain'
import type { LabStore } from './store'

// Внешний мир цикла: кадры, монотонные часы (мс) и видимость вкладки
export interface SimulationEnv {
  requestAnimationFrame(callback: FrameRequestCallback): number
  cancelAnimationFrame(id: number): void
  now(): number
  document: {
    readonly hidden: boolean
    addEventListener(type: 'visibilitychange', listener: () => void): void
    removeEventListener(type: 'visibilitychange', listener: () => void): void
  }
}

// Кадр дольше этого (фоновый троттлинг, подвисание) не даёт пачки тиков
const MAX_FRAME_MS = 1000

// Запускает цикл: за кадр копит тики по скорости и гонит целую часть одним advance; возвращает stop
export function startSimulation(store: LabStore, env: SimulationEnv): () => void {
  let frameId: number | null = null
  let last = env.now()
  let acc = 0

  function frame(): void {
    const now = env.now()
    const elapsed = Math.min(now - last, MAX_FRAME_MS)
    last = now
    const { speed } = store.getState()
    if (speed === 0 || env.document.hidden) {
      acc = 0
    } else {
      acc += (elapsed * speed) / CONFIG.tick.realMsAtX1
      const ticks = Math.floor(acc)
      acc -= ticks
      store.advance(ticks)
    }
    frameId = env.requestAnimationFrame(frame)
  }

  // Время простоя вкладки не догоняется: начинаем отсчёт заново
  function onVisibilityChange(): void {
    last = env.now()
    acc = 0
  }

  env.document.addEventListener('visibilitychange', onVisibilityChange)
  frameId = env.requestAnimationFrame(frame)

  return () => {
    if (frameId !== null) env.cancelAnimationFrame(frameId)
    frameId = null
    env.document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
