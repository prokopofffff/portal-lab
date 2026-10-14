// Пиксель-арт в SVG: клетки сетки склеиваются в один <path> по горизонтальным отрезкам.

export type Cell = readonly [x: number, y: number]

/** Путь SVG из клеток; соседние по строке клетки сливаются в один прямоугольник. */
export function cellsToPath(cells: Iterable<Cell>): string {
  const rows = new Map<number, number[]>()
  for (const [x, y] of cells) {
    const row = rows.get(y)
    if (row) row.push(x)
    else rows.set(y, [x])
  }
  const parts: string[] = []
  for (const [y, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b)
    let start = xs[0]!
    let len = 1
    for (let i = 1; i <= xs.length; i++) {
      const x = xs[i]
      if (x === start + len) {
        len++
        continue
      }
      parts.push(`M${start} ${y}h${len}v1h-${len}z`)
      if (x !== undefined) {
        start = x
        len = 1
      }
    }
  }
  return parts.join('')
}

/** Клетки из «рисунка» строками: «#» — закрашено, остальное — пусто. */
export function cellsFromArt(art: readonly string[], dx = 0, dy = 0): Cell[] {
  const cells: Cell[] = []
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') cells.push([x + dx, y + dy])
  })
  return cells
}
