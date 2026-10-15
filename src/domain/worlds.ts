// Имена и шифры миров (docs/spec.md §2.4, Приложение A).

type Gender = 'м' | 'ж' | 'ср' | 'мн'

// Прилагательные в четырёх формах: м / ж / ср / мн (spec Приложение A)
const ADJECTIVES: readonly (readonly [string, string, string, string])[] = [
  ['Пепельный', 'Пепельная', 'Пепельное', 'Пепельные'],
  ['Багровый', 'Багровая', 'Багровое', 'Багровые'],
  ['Туманный', 'Туманная', 'Туманное', 'Туманные'],
  ['Хрустальный', 'Хрустальная', 'Хрустальное', 'Хрустальные'],
  ['Шепчущий', 'Шепчущая', 'Шепчущее', 'Шепчущие'],
  ['Забытый', 'Забытая', 'Забытое', 'Забытые'],
  ['Звёздный', 'Звёздная', 'Звёздное', 'Звёздные'],
  ['Сумрачный', 'Сумрачная', 'Сумрачное', 'Сумрачные'],
  ['Ледяной', 'Ледяная', 'Ледяное', 'Ледяные'],
  ['Огненный', 'Огненная', 'Огненное', 'Огненные'],
  ['Костяной', 'Костяная', 'Костяное', 'Костяные'],
  ['Янтарный', 'Янтарная', 'Янтарное', 'Янтарные'],
  ['Безмолвный', 'Безмолвная', 'Безмолвное', 'Безмолвные'],
  ['Изумрудный', 'Изумрудная', 'Изумрудное', 'Изумрудные'],
  ['Призрачный', 'Призрачная', 'Призрачное', 'Призрачные'],
  ['Древний', 'Древняя', 'Древнее', 'Древние'],
  ['Гнилой', 'Гнилая', 'Гнилое', 'Гнилые'],
  ['Золотой', 'Золотая', 'Золотое', 'Золотые'],
  ['Бездонный', 'Бездонная', 'Бездонное', 'Бездонные'],
  ['Мерцающий', 'Мерцающая', 'Мерцающее', 'Мерцающие'],
]

// Существительные с родом (spec Приложение A)
const NOUNS: readonly { readonly word: string; readonly gender: Gender }[] = [
  { word: 'Шпиль', gender: 'м' },
  { word: 'Колодец', gender: 'м' },
  { word: 'Лабиринт', gender: 'м' },
  { word: 'Курган', gender: 'м' },
  { word: 'Сад', gender: 'м' },
  { word: 'Маяк', gender: 'м' },
  { word: 'Бездна', gender: 'ж' },
  { word: 'Башня', gender: 'ж' },
  { word: 'Пещера', gender: 'ж' },
  { word: 'Чаща', gender: 'ж' },
  { word: 'Гавань', gender: 'ж' },
  { word: 'Око', gender: 'ср' },
  { word: 'Зеркало', gender: 'ср' },
  { word: 'Болото', gender: 'ср' },
  { word: 'Ущелье', gender: 'ср' },
  { word: 'Святилище', gender: 'ср' },
  { word: 'Топи', gender: 'мн' },
  { word: 'Чертоги', gender: 'мн' },
  { word: 'Катакомбы', gender: 'мн' },
  { word: 'Пустоши', gender: 'мн' },
]

const GENDER_FORM: Record<Gender, 0 | 1 | 2 | 3> = { м: 0, ж: 1, ср: 2, мн: 3 }

// Все 20 × 20 = 400 миров: имя в именительном падеже, прилагательное согласовано с родом
export const WORLD_NAMES: readonly string[] = ADJECTIVES.flatMap((forms) =>
  NOUNS.map(({ word, gender }) => `${forms[GENDER_FORM[gender]]} ${word}`),
)

// FNV-1a 32 бита по UTF-16 кодам символов (spec §2.4)
function fnv1a32(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// Шифр мира: первая буква прилагательного + первая буква существительного + "-" + 3 цифры
export function worldCode(name: string): string {
  const [adjective = '', noun = ''] = name.split(' ')
  const digits = String(fnv1a32(name) % 1000).padStart(3, '0')
  return `${adjective.charAt(0)}${noun.charAt(0)}-${digits}`
}

// Название портала: шифр мира + номер посещения (spec §2.4)
export function portalName(name: string, visit: number): string {
  return `${worldCode(name)}-${visit}`
}

// Виды существ по силуэтам спрайта (слизень, рогач, призрак, жук) и приметы — все мужского рода
const CREATURE_SPECIES = ['слизень', 'бес', 'призрак', 'жук'] as const
const CREATURE_TRAITS = [
  'Рогатый',
  'Серый',
  'Панцирный',
  'Болотный',
  'Бледный',
  'Клыкастый',
  'Кривой',
] as const

// Имя существа мира по номеру (с 0): первое носит прилагательное мира, остальные — приметы по
// кругу. Вид идёт по кругу из 4, приметы — из 7, поэтому имена не повторяются до 29-го существа.
export function creatureName(worldName: string, index: number): string {
  const species = CREATURE_SPECIES[index % CREATURE_SPECIES.length]
  if (index === 0) {
    const adjective = worldName.split(' ')[0] ?? ''
    const forms = ADJECTIVES.find((f) => f.includes(adjective))
    return `${forms ? forms[0] : adjective} ${species}`
  }
  return `${CREATURE_TRAITS[(index - 1) % CREATURE_TRAITS.length]} ${species}`
}
