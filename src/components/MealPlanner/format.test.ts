import { describe, expect, it } from 'vitest'
import { formatMealMacros, formatNumber } from './format'

describe('formatNumber', () => {
  it('rounds and groups thousands with a non-breaking space', () => {
    expect(formatNumber(825.6)).toBe('826')
    expect(formatNumber(1800)).toBe('1 800')
    expect(formatNumber(12345)).toBe('12 345')
  })
})

describe('formatMealMacros', () => {
  it('builds the short macro line and treats missing values as zero', () => {
    expect(formatMealMacros({ totalKcal: 826, totalProtein: 37.4, totalFat: 43, totalCarbs: 69.6 })).toBe(
      '826 kcal · B 37 g · T 43 g · W 70 g'
    )
    expect(formatMealMacros({})).toBe('0 kcal · B 0 g · T 0 g · W 0 g')
  })
})
