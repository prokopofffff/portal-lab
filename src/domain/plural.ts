// Русское склонение числительных для текстов домена.

// «наблюдатель» / «наблюдателя» / «наблюдателей» по числу
export function observersNoun(n: number): string {
  const lastTwo = n % 100
  const last = n % 10
  if (lastTwo >= 11 && lastTwo <= 14) return 'наблюдателей'
  if (last === 1) return 'наблюдатель'
  if (last >= 2 && last <= 4) return 'наблюдателя'
  return 'наблюдателей'
}
