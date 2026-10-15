// Визуальные токены по канвасу «Лаборатория порталов» — docs/design/ (экспорт канваса, источник истины).
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
  // атлас и страница мира: погреб, пергамент, чернила, золото, полоски изучения
  cellar: '#1d1510',
  cellarSeam: '#17100c',
  cellarTitle: '#f1deae',
  cellarLabel: '#cdb98a',
  cellarIcon: '#c9a24a',
  tab: '#2a1d14',
  tabOnEdge: '#ffe59a',
  parchmentShade: '#bda877',
  parchmentPlate: '#d6c392',
  parchmentSpine: '#3a2a18',
  parchmentIcon: '#a89468',
  pin: '#b3243c', // кнопка-булавка записки в зале
  pinShade: '#6e1424',
  inkBody: '#3a2a1a',
  inkSoft: '#5a4a34',
  inkLabel: '#6e4a1a',
  inkTime: '#6e5a3a',
  inkLink: '#4a2f8a',
  goldPlate: '#f0cf6a',
  onGoldPlate: '#5a4208',
  goldEdge: '#a67a12',
  barStudy: '#5a3fa8',
  barStudyNext: '#7a64b8',
  barStudied: '#c9961a',
  rowStage: '#0f0c16',
  rowText: '#cbc2de',
  rowTitle: '#f4ecd8',
  // книга журнала: дубовый стол, переплёт, закладки, подписи под книгой
  desk: '#24160f',
  deskSeamV: '#1c110b',
  deskSeamH: '#1f130d',
  bookCover: '#4a2f1c',
  bookCoverShadow: '#170d08',
  bookSpineLight: '#8d7040',
  bookSpineDark: '#4a3418',
  inkFaint: '#6b5c43', // в канвасе #8f7e60 (2.8:1), затемнено до 4.6:1
  emptyIcon: '#b8a578', // значок пустой книги, только украшение
  ribbonRejection: '#9b1c2c',
  ribbonPortal: '#2f5fa8',
  ribbonWorld: '#2c7449', // в канвасе #2f7a4f (подпись 4.4:1), затемнено до 4.8:1
  ribbonLabel: '#f6e9d8',
  onRibbon: '#ffffff',
  legendRejection: '#ff8099',
  legendSystem: '#b4a88a',
  // наблюдатели
  observerFree: '#7a9be0',
  observerOnSite: '#5fcf9a',
  observerTransit: '#a9a3c0',
  // HUD и док: кнопки, пауза, слоты наблюдателей, счётчики, печать лаборатории
  control: '#221e2d', // неактивная кнопка скорости и вкладка дока
  pauseOn: '#8fb4ff',
  pauseOnEdge: '#cfe0ff',
  divider: '#2b2538',
  observerFreeBg: '#1d2a47',
  observerOnSiteBg: '#173a2c',
  observerTransitEdge: '#8a85a0',
  lostCount: '#c9c3d8',
  statHigh: '#ffb36b',
  statCritical: '#ff8099',
  statCriticalLabel: '#ffb0bf',
  seal: '#a79bb8',
  sealEdge: '#5a2b3a',
  sealLock: '#a84a63',
  // зал: баннеры «все арки заняты» и «пауза», значки у арки, табличка портала
  fullBanner: '#ffc2cd',
  fullBannerBg: '#4a0f20',
  pauseBanner: '#dbe8ff',
  observerOnSiteText: '#a8f5c8',
  questionedBg: '#3a2a05',
  acceptedBg: '#0f3a2c',
  sharedWorld: '#c8b8ff',
  sharedWorldBg: '#241d3d',
  sharedWorldEdge: '#6d5ac8',
  studyNext: '#6a55a0',
  // карточка портала (канвас 23-c-portal-card): сцена, записка, печать, способности, перезарядка
  textFaint: '#a79bb8', // время в истории, системные записи, подписи наблюдателей
  sceneGrid: '#17131f',
  sceneFloor: '#201b2b',
  stamp: '#d9a0a8',
  stickyNote: '#f0dc8a',
  stickyNoteShade: '#c9b25a',
  stickyNoteInk: '#3a2a0a',
  hardRuleBg: '#3a0c18',
  tipText: '#ffd0d8',
  ability: '#2a2438',
  abilityEdge: '#6a5f80',
  abilityOff: '#1a1722', // недоступная способность и плашка статуса архивного портала
  abilityOffIcon: '#8a7fa6',
  abilityRec: '#4a3510',
  abilityRecText: '#fff1c9',
  abilityShade: 'rgba(0, 0, 0, 0.35)',
  cooldownShade: 'rgba(10, 8, 16, 0.78)',
  cooldownLit: 'rgba(255, 255, 255, 0.14)',
  onCooldown: '#ffffff',
  archivedPlate: '#2c2a38', // плашка риска и рамка разбора у архивной карточки
  archivedText: '#c9c3d8',
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

const stoneDeep = '#241f30'

/** Цвета спрайтов из канваса (арка, руны, полоска, существа), которых нет среди общих цветов. */
export const sprite = {
  // камень арки: основа, светлая грань свода, тень, освещённый и тёмный бок, замковый камень
  archStone: '#3a3348',
  stoneLight: '#6a5f80',
  stoneShadow: '#2a2536',
  stoneLit: '#5b5068',
  stoneDeep,
  keystone: '#7d7096',
  sill: '#17141f', // нижняя линия арки
  emberRune: '#b8742a', // тлеющие руны пустой арки
  // фигурка наблюдателя
  observerCloak: '#9bbcff',
  observerFace: '#ffe3bd',
  observerBelt: '#5b75d0',
  observerLegs: '#3a4a8a',
  observerOutline: colors.well,
  // руна закрытого портала
  deadRune: '#8a85a0',
  // полоска: колодец, рамка, погасший сегмент, блик и тень сегментов
  barTrack: colors.well,
  barBorder: colors.edge,
  barUnlit: stoneDeep,
  barGloss: 'rgba(255, 255, 255, 0.35)',
  barShade: 'rgba(0, 0, 0, 0.25)',
  barHollow: 'rgba(0, 0, 0, 0.35)',
  // клетки существ: изученное, всё изучено, изучается, неизвестное
  cellBg: '#1e1a2b',
  cellEdge: '#8a7fa6',
  studiedGold: '#e8b948',
  studyBg: '#14101f',
  study: '#b78cff',
  studyGhost: '#2f2945',
  studyBadge: '#e3d6ff',
  unknownBg: '#0c0a12',
  unknownEdge: colors.edgeSoft,
  unknownGlyph: '#5e5478',
  unknownLabel: '#a79bb8', // «???» под неизвестным существом на странице мира
  // HUD: песочные часы, лицо и значок портала в слоте наблюдателя, надгробие потерянных
  hourglassFrame: '#c9a24a',
  hourglassGlass: '#8a7fa6',
  slotFace: '#f1d9b3',
  slotPortalEdge: '#c8b8ff',
  slotPortal: '#6d5ac8',
  tombstone: '#8a85a0',
  tombstoneMark: '#3a3548',
  // факел на стене зала: древко, пламя, сердцевина и самый жар
  torchHandle: '#5b4a3a',
  flame: '#e8821e',
  flameCore: colors.torchLight,
  flameHeart: '#fff4c2',
} as const

/** Пять цветов существ, по кругу. */
export const creatureColors = ['#7ee0a8', '#ff9a5c', '#9bb7ff', '#f0c8ff', '#ffd96a'] as const

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
  { name: 'чернила текста на пергаменте', fg: colors.inkBody, bg: colors.parchment, min: 4.5 },
  { name: 'мягкие чернила на пергаменте', fg: colors.inkSoft, bg: colors.parchment, min: 4.5 },
  { name: 'метка на пергаменте', fg: colors.inkLabel, bg: colors.parchment, min: 4.5 },
  { name: 'время на пергаменте', fg: colors.inkTime, bg: colors.parchment, min: 4.5 },
  { name: 'ссылка на пергаменте', fg: colors.inkLink, bg: colors.parchment, min: 4.5 },
  { name: 'шифр мира на плашке', fg: colors.inkLabel, bg: colors.parchmentPlate, min: 4.5 },
  { name: 'заметка на плашке', fg: colors.inkBody, bg: colors.parchmentPlate, min: 4.5 },
  { name: 'метка «изучен» на золоте', fg: colors.onGoldPlate, bg: colors.goldPlate, min: 4.5 },
  { name: 'вкладка выбрана', fg: colors.onTorch, bg: colors.goldPlate, min: 4.5 },
  { name: 'вкладка', fg: colors.parchment, bg: colors.tab, min: 4.5 },
  { name: 'подпись на погребе', fg: colors.cellarLabel, bg: colors.cellar, min: 4.5 },
  { name: 'заголовок на погребе', fg: colors.cellarTitle, bg: colors.cellar, min: 4.5 },
  { name: 'статус портала в строке', fg: colors.rowText, bg: sprite.sill, min: 4.5 },
  { name: 'имя портала в строке', fg: colors.rowTitle, bg: sprite.sill, min: 4.5 },
  { name: 'процент изучения на клетке', fg: sprite.studyBadge, bg: colors.well, min: 4.5 },
  { name: 'имя изученного существа', fg: colors.text, bg: sprite.cellBg, min: 4.5 },
  { name: 'изучаемое существо', fg: sprite.studyBadge, bg: sprite.studyBg, min: 4.5 },
  { name: 'неизвестное существо', fg: sprite.unknownLabel, bg: sprite.unknownBg, min: 4.5 },
  { name: 'метка книги на столе', fg: colors.cellarLabel, bg: colors.desk, min: 4.5 },
  { name: 'заголовок книги на столе', fg: colors.cellarTitle, bg: colors.desk, min: 4.5 },
  { name: 'время записи на пергаменте', fg: colors.inkFaint, bg: colors.parchment, min: 4.5 },
  { name: 'легенда: отказ на столе', fg: colors.legendRejection, bg: colors.desk, min: 4.5 },
  { name: 'легенда: система на столе', fg: colors.legendSystem, bg: colors.desk, min: 4.5 },
  { name: 'закладка «вид»: название', fg: colors.onRibbon, bg: colors.ribbonRejection, min: 4.5 },
  { name: 'закладка «вид»: подпись', fg: colors.ribbonLabel, bg: colors.ribbonRejection, min: 4.5 },
  { name: 'закладка «портал»: название', fg: colors.onRibbon, bg: colors.ribbonPortal, min: 4.5 },
  { name: 'закладка «портал»: подпись', fg: colors.ribbonLabel, bg: colors.ribbonPortal, min: 4.5 },
  { name: 'закладка «мир»: название', fg: colors.onRibbon, bg: colors.ribbonWorld, min: 4.5 },
  { name: 'закладка «мир»: подпись', fg: colors.ribbonLabel, bg: colors.ribbonWorld, min: 4.5 },
  { name: 'время в HUD', fg: colors.torchLight, bg: colors.panel, min: 4.5 },
  { name: 'подпись слота на панели', fg: colors.textSoft, bg: colors.panel, min: 4.5 },
  { name: 'подпись пустого слота на панели', fg: colors.textDim, bg: colors.panel, min: 4.5 },
  { name: 'число потерянных на панели', fg: colors.lostCount, bg: colors.panel, min: 4.5 },
  { name: 'кнопка скорости', fg: colors.textSoft, bg: colors.control, min: 4.5 },
  { name: 'пауза включена', fg: colors.onTorch, bg: colors.pauseOn, min: 4.5 },
  { name: 'счётчик: подпись', fg: colors.textMuted, bg: colors.well, min: 4.5 },
  { name: 'счётчик: число', fg: colors.text, bg: colors.well, min: 4.5 },
  { name: 'счётчик: лимит порталов', fg: colors.statHigh, bg: colors.well, min: 4.5 },
  { name: 'счётчик: критические, число', fg: colors.statCritical, bg: colors.well, min: 4.5 },
  {
    name: 'счётчик: критические, подпись',
    fg: colors.statCriticalLabel,
    bg: colors.well,
    min: 4.5,
  },
  { name: 'печать лаборатории на панели', fg: colors.seal, bg: colors.panel, min: 4.5 },
  { name: 'зал: метка тревожных знаков', fg: colors.torch, bg: colors.stone, min: 4.5 },
  { name: 'зал: подпись фильтра', fg: colors.textSoft, bg: colors.stone, min: 4.5 },
  { name: 'зал: все арки заняты', fg: colors.fullBanner, bg: colors.fullBannerBg, min: 4.5 },
  { name: 'зал: пауза', fg: colors.pauseBanner, bg: colors.observerFreeBg, min: 4.5 },
  { name: 'зал: пустое состояние', fg: colors.torchLight, bg: colors.control, min: 4.5 },
  { name: 'пустая арка: подпись', fg: colors.textDim, bg: colors.stone, min: 4.5 },
  { name: 'первая арка: подсказка', fg: colors.torchLight, bg: colors.stone, min: 4.5 },
  { name: 'табличка: имя', fg: colors.rowTitle, bg: sprite.sill, min: 4.5 },
  { name: 'табличка: мир', fg: colors.rowText, bg: sprite.sill, min: 4.5 },
  { name: 'табличка: метка полоски', fg: colors.textMuted, bg: sprite.sill, min: 4.5 },
  { name: 'табличка: число', fg: colors.text, bg: sprite.sill, min: 4.5 },
  { name: 'табличка: общий мир', fg: colors.sharedWorld, bg: colors.sharedWorldBg, min: 4.5 },
  {
    name: 'значок наблюдателей у арки',
    fg: colors.observerOnSiteText,
    bg: colors.observerOnSiteBg,
    min: 4.5,
  },
  { name: 'карточка: время в истории', fg: colors.textFaint, bg: colors.rowStage, min: 4.5 },
  { name: 'карточка: подпись метрики', fg: colors.textSoft, bg: sprite.sill, min: 4.5 },
  { name: 'карточка: печать архива', fg: colors.stamp, bg: colors.rowStage, min: 4.5 },
  { name: 'карточка: записка', fg: colors.stickyNoteInk, bg: colors.stickyNote, min: 4.5 },
  { name: 'карточка: жёсткое правило', fg: risk.critical.onPlate, bg: colors.hardRuleBg, min: 4.5 },
  { name: 'карточка: подсказка отказа', fg: colors.tipText, bg: colors.well, min: 4.5 },
  { name: 'карточка: способность', fg: colors.text, bg: colors.ability, min: 4.5 },
  {
    name: 'карточка: рекомендованная способность',
    fg: colors.abilityRecText,
    bg: colors.abilityRec,
    min: 4.5,
  },
  { name: 'карточка: статус архива', fg: colors.archivedText, bg: colors.abilityOff, min: 4.5 },
  { name: 'карточка: риск архива', fg: colors.archivedText, bg: colors.archivedPlate, min: 4.5 },
  {
    name: 'карточка: снижение риска',
    fg: colors.observerOnSiteText,
    bg: colors.acceptedBg,
    min: 4.5,
  },
  ...(Object.entries(risk) as [string, (typeof risk)[RiskLevel]][]).map(([k, r]) => ({
    name: `плашка риска «${k}»`,
    fg: r.onPlate,
    bg: r.plate,
    min: 4.5,
  })),
]

/** CSS-переменные: --c-<имя>, --risk-<уровень>-{c,plate,on}, --s-<цвет спрайта>, --f-<шрифт>. */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {}
  const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
  for (const [k, v] of Object.entries(colors)) vars[`--c-${kebab(k)}`] = v
  for (const [k, r] of Object.entries(risk)) {
    vars[`--risk-${k}-c`] = r.c
    vars[`--risk-${k}-plate`] = r.plate
    vars[`--risk-${k}-on`] = r.onPlate
  }
  for (const [k, v] of Object.entries(sprite)) vars[`--s-${kebab(k)}`] = v
  for (const [k, v] of Object.entries(fonts)) vars[`--f-${k}`] = v
  return vars
}
