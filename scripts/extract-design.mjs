// Распаковывает экспорт канваса Claude Design (docs/design/canvas.html) в читаемые исходники кадров
// docs/design/frames/NN-slug.html и, с флагом --png, в скриншоты кадров NN-slug.png.
// Запуск: node scripts/extract-design.mjs [--png]
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const bundlePath = `${root}docs/design/canvas.html`
const outDir = `${root}docs/design/frames`

const slugs = {
  'Зал · обычная работа, критический портал': 'hall',
  'Зал · пустая лаборатория': 'hall-empty',
  'Зал · все 12 арок заняты': 'hall-full',
  'Зал · пауза, время стоит': 'hall-paused',
  'Карточка · критический, наблюдатели внутри': 'card-critical',
  'Отказ · недоступная способность, баннер, запись': 'card-rejection',
  'До и после стабилизации': 'card-stabilize',
  'Два портала в один мир': 'card-shared-world',
  'Выцветшие карты · схлопнулся и закрыт': 'card-archived',
  'Язык риска': 'risk-language',
  'Атлас · пока пуст': 'atlas-empty',
  'Атлас миров · сортировка работает': 'atlas',
  'Страница мира · Пепельные Топи': 'world-page',
  'Книга журнала · пустая': 'journal-empty',
  'Книга журнала · три вида записей': 'journal',
  'Диалоги-свитки': 'dialogs',
  'Уведомления-баннеры': 'banners',
  'HUD смотрителя': 'c-hud',
  'Нижняя панель входа': 'c-dock',
  'Арка и портал': 'c-portal',
  'Руна риска': 'c-rune',
  'Пиксельная полоска': 'c-bar',
  'Существа мира': 'c-creatures',
  'Карта портала': 'c-portal-card',
  'Баннер уведомления': 'c-banner',
}

function bundleParts(html) {
  const part = (type) => {
    const m = html.match(new RegExp(`<script type="__bundler/${type}">([\\s\\S]*?)</script>`))
    if (!m) throw new Error(`нет блока __bundler/${type}`)
    return JSON.parse(m[1])
  }
  return { manifest: part('manifest'), template: part('template') }
}

function unpack(entry) {
  const bytes = Buffer.from(entry.data, 'base64')
  return (entry.compressed ? gunzipSync(bytes) : bytes).toString('utf8')
}

// Шрифты вшиты base64 и раздувают исходник; для чтения дизайна они не нужны.
function stripFonts(html) {
  return html
    .replace(/\/\*[^*]*\*\/\s*@font-face\s*\{[^}]*\}\s*/g, '')
    .replace(/@font-face\s*\{[^}]*\}\s*/g, '')
}

const { manifest, template } = bundleParts(readFileSync(bundlePath, 'utf8'))
const frames = [
  ...template.matchAll(
    /<iframe src="about:blank#([\w-]+)" title="([^"]+)" width="(\d+)" height="(\d+)"/g,
  ),
].map(([, id, title, width, height], i) => ({
  id,
  title,
  width: Number(width),
  height: Number(height),
  name: `${String(i).padStart(2, '0')}-${slugs[title] ?? 'frame'}`,
}))

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
for (const { id, title, name } of frames) {
  const entry = manifest[id]
  if (!entry) throw new Error(`кадр «${title}» отсутствует в манифесте`)
  const source = stripFonts(bundleParts(unpack(entry)).template)
  const header = `<!-- Кадр канваса «${title}». Сгенерировано scripts/extract-design.mjs из docs/design/canvas.html — не редактировать. -->\n`
  writeFileSync(`${outDir}/${name}.html`, header + source)
  console.log(`${name}.html  ${title}`)
}

// Каждый кадр — самостоятельный бандл; рендерим его отдельно в размере кадра на канвасе.
if (process.argv.includes('--png')) {
  const { chromium } = await import('@playwright/test')
  const tmp = mkdtempSync(`${tmpdir()}/canvas-`)
  const browser = await chromium.launch()
  for (const { id, name, width, height } of frames) {
    const file = `${tmp}/${name}.html`
    writeFileSync(file, unpack(manifest[id]))
    const page = await browser.newPage({ viewport: { width, height } })
    await page.goto(`file://${file}`)
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${outDir}/${name}.png`, animations: 'disabled' })
    await page.close()
  }
  await browser.close()
  rmSync(tmp, { recursive: true, force: true })
  console.log(`${frames.length} скриншотов`)
}
