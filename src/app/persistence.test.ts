import { beforeEach, describe, expect, it } from 'vitest'
import { advance, createLab, createRng, dispatch, type SavedGame } from '../domain'
import { STORAGE_KEY, loadGame, saveGame } from './persistence'

const NOW = Date.UTC(2026, 9, 14, 12, 0, 0)

function buildSave(): SavedGame {
  const rng = createRng(7)
  let lab = dispatch(createLab(), { type: 'openPortal' }, rng, NOW).lab
  lab = dispatch(lab, { type: 'openPortal' }, rng, NOW + 1).lab
  lab = advance(lab, NOW + 1000).lab
  return { lab, rngState: rng.state() }
}

describe('сохранение в localStorage (spec §1, §10)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('сохранённая игра читается обратно без потерь', () => {
    const save = buildSave()

    saveGame(localStorage, save)

    expect(loadGame(localStorage)).toEqual(save)
  })

  it('пустое хранилище — нет сохранения', () => {
    expect(loadGame(localStorage)).toBeNull()
  })

  it('мусор под ключом сохранения не роняет загрузку', () => {
    localStorage.setItem(STORAGE_KEY, '{"version": 1, "lab": ')

    expect(loadGame(localStorage)).toBeNull()
  })

  it('недоступное хранилище при чтении — нет сохранения', () => {
    const broken = {
      getItem: () => {
        throw new DOMException('доступ запрещён', 'SecurityError')
      },
    }

    expect(loadGame(broken)).toBeNull()
  })

  it('ошибка записи (квота, приватный режим) не роняет приложение', () => {
    const full = {
      setItem: () => {
        throw new DOMException('квота исчерпана', 'QuotaExceededError')
      },
    }

    expect(() => saveGame(full, buildSave())).not.toThrow()
  })
})
