// Считает токены Claude Code по проекту для AI Worklog (src/ui/worklog/worklog.ts): складывает usage
// всех ответов из транскриптов ~/.claude/projects/*mox-test*/**/*.jsonl, включая субагентов.
// Ответ, разбитый на несколько строк транскрипта, считается один раз (по message.id + requestId).
// Запуск: node scripts/count-tokens.mjs
import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const projects = join(homedir(), '.claude', 'projects')
const FIELDS = [
  ['output_tokens', 'вывод модели'],
  ['input_tokens', 'ввод без кэша'],
  ['cache_creation_input_tokens', 'запись в кэш'],
  ['cache_read_input_tokens', 'чтение из кэша'],
]

const transcripts = readdirSync(projects)
  .filter((dir) => dir.includes('mox-test'))
  .flatMap((dir) =>
    readdirSync(join(projects, dir), { recursive: true })
      .filter((file) => String(file).endsWith('.jsonl'))
      .map((file) => join(projects, dir, String(file))),
  )

const totals = Object.fromEntries(FIELDS.map(([key]) => [key, 0]))
const models = {}
const seen = new Set()
let first = null
let last = null

for (const file of transcripts) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (entry.timestamp) {
      if (!first || entry.timestamp < first) first = entry.timestamp
      if (!last || entry.timestamp > last) last = entry.timestamp
    }
    const message = entry.message
    if (!message?.usage) continue
    const key = `${message.id}:${entry.requestId}`
    if (seen.has(key)) continue
    seen.add(key)
    for (const [field] of FIELDS) totals[field] += message.usage[field] ?? 0
    if (message.model && message.model !== '<synthetic>')
      models[message.model] = (models[message.model] ?? 0) + 1
  }
}

const fmt = (n) => n.toLocaleString('ru-RU')
console.log(`транскриптов: ${transcripts.length}, ответов: ${seen.size}`)
console.log(`период: ${first} — ${last}`)
for (const [field, label] of FIELDS) console.log(`${label}: ${fmt(totals[field])}`)
console.log(`всего: ${fmt(Object.values(totals).reduce((a, b) => a + b, 0))}`)
console.log('ответов по моделям:', models)
