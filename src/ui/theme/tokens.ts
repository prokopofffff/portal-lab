// Визуальные токены по канвасу «Лаборатория порталов»:
// https://claude.ai/artifact/LTfC5K5ryUv252BkNsAzTb
// Единственный источник цветов и шрифтов; в CSS попадают через applyTheme().

export const fonts = {
  pixel: "'Press Start 2P', monospace", // заголовки и числа
  ui: "'Tektur', 'Trebuchet MS', sans-serif", // интерфейс
  prose: "'Alegreya', Georgia, serif", // длинный текст, описания
  ink: "'Marck Script', cursive", // книга: действия и отказы
  faded: "'Caveat', cursive", // книга: системные записи
} as const

export const colors = {
  // подземелье
  night: '#0e0c16',
  stone: '#1b1724',
  stoneSeam: '#14111c',
  panel: '#14111c',
  well: '#0b0911',
  edge: '#3d3649',
  edgeSoft: '#2e2840',
  edgeStrong: '#453d56',
  // текст на тёмном
  text: '#efe6d0',
  textSoft: '#d8cfea',
  textMuted: '#b4abc6',
  textDim: '#8f86a3',
  // акцент — свет факела
  torch: '#ffb347',
  torchLight: '#ffd98a',
  torchDeep: '#b86a14',
  onTorch: '#1b1424',
  // пергамент (атлас, книга, свитки)
  parchment: '#e9d9b0',
  parchmentLine: '#d9c898',
  parchmentEdge: '#6a5238',
  inkAction: '#3b2a18',
  inkRejection: '#9b1c2c',
  inkSystem: '#6b5c43', // в канвасе #9a8a70 (2.4:1), затемнено до 4.6:1
  inkTitle: '#2a1d12',
  // наблюдатели
  observerFree: '#7a9be0',
  observerOnSite: '#5fcf9a',
  observerTransit: '#a9a3c0',
} as const

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type PortalLook = RiskLevel | 'archived' | 'empty'

/** Цвет уровня риска: c — свечение/акцент, plate — фон плашки, onPlate — текст на плашке. */
export const risk: Record<
  RiskLevel | 'archived',
  { label: string; c: string; plate: string; onPlate: string }
> = {
  low: { label: 'Низкий', c: '#5be0c0', plate: '#0f4a40', onPlate: '#b4f7e6' },
  medium: { label: 'Средний', c: '#ffd34d', plate: '#5a4a10', onPlate: '#ffeaa3' },
  high: { label: 'Высокий', c: '#ff8a2b', plate: '#6a3010', onPlate: '#ffcfa3' },
  critical: { label: 'Критический', c: '#ff4466', plate: '#6a1428', onPlate: '#ffbac6' },
  archived: { label: 'Архив', c: '#6a6680', plate: '#26222f', onPlate: '#d8cfea' },
}

/** Четыре оттенка портала в арке: от края к ядру. */
export const portalShades: Record<PortalLook, readonly [string, string, string, string]> = {
  low: ['#0b3a36', '#178f80', '#5be0c0', '#d6fff3'],
  medium: ['#3a3008', '#8f7a1c', '#ffd34d', '#fff4c2'],
  high: ['#4a1d08', '#b04a12', '#ff8a2b', '#ffe0b0'],
  critical: ['#4a0a1c', '#a31a3c', '#ff4466', '#ffd0d8'],
  archived: ['#1a1822', '#2c2a38', '#46435a', '#6a6680'],
  empty: ['#0a0810', '#0a0810', '#0a0810', '#0a0810'],
}

/** Пары текст/фон, которые реально встречаются в интерфейсе; min — порог WCAG. */
export const textPairs: { name: string; fg: string; bg: string; min: number }[] = [
  { name: 'текст на панели', fg: colors.text, bg: colors.panel, min: 4.5 },
  { name: 'мягкий текст на камне', fg: colors.textSoft, bg: colors.stone, min: 4.5 },
  { name: 'приглушённый текст на панели', fg: colors.textMuted, bg: colors.panel, min: 4.5 },
  { name: 'тусклый текст на колодце', fg: colors.textDim, bg: colors.well, min: 4.5 },
  { name: 'кнопка-факел', fg: colors.onTorch, bg: colors.torch, min: 4.5 },
  { name: 'чернила действия на пергаменте', fg: colors.inkAction, bg: colors.parchment, min: 4.5 },
  { name: 'чернила отказа на пергаменте', fg: colors.inkRejection, bg: colors.parchment, min: 4.5 },
  { name: 'системные чернила на пергаменте', fg: colors.inkSystem, bg: colors.parchment, min: 4.5 },
  { name: 'заголовок на пергаменте', fg: colors.inkTitle, bg: colors.parchment, min: 4.5 },
  ...(Object.entries(risk) as [string, (typeof risk)[RiskLevel]][]).map(([k, r]) => ({
    name: `плашка риска «${k}»`,
    fg: r.onPlate,
    bg: r.plate,
    min: 4.5,
  })),
]

/** CSS-переменные: --c-<имя>, --risk-<уровень>-{c,plate,on}, --f-<шрифт>. */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {}
  const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  for (const [k, v] of Object.entries(colors)) vars[`--c-${kebab(k)}`] = v
  for (const [k, r] of Object.entries(risk)) {
    vars[`--risk-${k}-c`] = r.c
    vars[`--risk-${k}-plate`] = r.plate
    vars[`--risk-${k}-on`] = r.onPlate
  }
  for (const [k, v] of Object.entries(fonts)) vars[`--f-${k}`] = v
  return vars
}
