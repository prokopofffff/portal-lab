import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { worklog } from './worklog'
import { WorklogScreen } from './WorklogScreen'

// Одиннадцать пунктов задания: 4–6 (этапы, кто что делал, промпты) живут в карточках этапов
const SECTIONS = [
  'AI-инструменты',
  'Время разработки',
  'Токены',
  'Этапы работы',
  'Решения человека',
  'Где AI ошибся',
  'Что переписано вручную',
  'Как проверялось',
  'Что улучшить',
]

const section = (name: string) => screen.getByRole('region', { name })

describe('экран AI Worklog', () => {
  it('заголовок экрана и все разделы задания', () => {
    render(<WorklogScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'AI WORKLOG' })).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(SECTIONS)
  })

  it('по каждому этапу: что делал человек, что делал AI, суть ключевых запросов', () => {
    render(<WorklogScreen />)
    const stages = within(section('Этапы работы')).getAllByRole('article')
    expect(stages).toHaveLength(worklog.stages.length)
    worklog.stages.forEach((stage, i) => {
      const card = within(stages[i]!)
      expect(card.getByRole('heading', { level: 3 })).toHaveTextContent(stage.title)
      expect(card.getByText('Человек')).toBeInTheDocument()
      expect(card.getByText('AI')).toBeInTheDocument()
      expect(card.getByText('Суть запросов')).toBeInTheDocument()
      expect(stage.prompts.length).toBeGreaterThan(0)
      for (const prompt of stage.prompts) expect(card.getByText(prompt)).toBeInTheDocument()
    })
  })

  it('решений человека от трёх до пяти', () => {
    render(<WorklogScreen />)
    const items = within(section('Решения человека')).getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.length).toBeLessThanOrEqual(5)
  })

  it('токены: итог, разбивка и источник подсчёта', () => {
    render(<WorklogScreen />)
    const tokens = within(section('Токены'))
    expect(tokens.getByText(worklog.tokens.total)).toBeInTheDocument()
    for (const row of worklog.tokens.rows) expect(tokens.getByText(row.label)).toBeInTheDocument()
    expect(tokens.getByText(worklog.tokens.note)).toBeInTheDocument()
  })

  it('списки ошибок AI, ручных правок, проверки и улучшений не пусты', () => {
    render(<WorklogScreen />)
    for (const name of ['Где AI ошибся', 'Как проверялось', 'Что улучшить'])
      expect(within(section(name)).getAllByRole('listitem').length).toBeGreaterThan(0)
    expect(within(section('Что переписано вручную')).getByText(worklog.manual)).toBeInTheDocument()
  })
})
