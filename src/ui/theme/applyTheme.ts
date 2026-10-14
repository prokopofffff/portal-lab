import { cssVariables } from './tokens'

export function applyTheme(root: HTMLElement): void {
  for (const [name, value] of Object.entries(cssVariables())) root.style.setProperty(name, value)
}
