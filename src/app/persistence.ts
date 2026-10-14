// Адаптер localStorage для сохранения игры (docs/spec.md §1, §10).
// Домен чистый, поэтому весь ввод-вывод хранилища — здесь.
import { parseSave, serializeSave, type SavedGame } from '../domain'

export const STORAGE_KEY = 'portal-lab'

// Читает сохранение; null — нет сохранения, оно битое или хранилище недоступно
export function loadGame(storage: Pick<Storage, 'getItem'>): SavedGame | null {
  try {
    return parseSave(storage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

// Пишет сохранение; ошибки хранилища (квота, приватный режим) не роняют приложение
export function saveGame(storage: Pick<Storage, 'setItem'>, save: SavedGame): void {
  try {
    storage.setItem(STORAGE_KEY, serializeSave(save))
  } catch {
    // сохранение не удалось — игра продолжается без него
  }
}
