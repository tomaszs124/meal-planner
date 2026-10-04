import { describe, expect, it } from 'vitest'
import { CATEGORY_LABELS } from './types'

describe('CATEGORY_LABELS', () => {
  it('has a Polish label for each of the five meal categories', () => {
    expect(CATEGORY_LABELS).toEqual({
      breakfast: 'Śniadanie',
      second_breakfast: 'Drugie śniadanie',
      lunch: 'Obiad',
      dinner: 'Kolacja',
      snack: 'Przekąska',
    })
  })
})
