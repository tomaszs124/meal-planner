import { describe, expect, it } from 'vitest'
import {
  IMAGE_MAX_DIMENSION,
  compressedFileName,
  extensionForType,
  fitWithin,
  targetTypeFor,
} from './image'

describe('fitWithin', () => {
  it('never upscales images that already fit', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 })
    expect(fitWithin(1, 1, 1600)).toEqual({ width: 1, height: 1 })
  })

  it('scales landscape images by the longer edge', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
  })

  it('scales portrait images by the longer edge', () => {
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('keeps the aspect ratio within rounding', () => {
    const { width, height } = fitWithin(4032, 2268, IMAGE_MAX_DIMENSION)
    expect(width).toBe(IMAGE_MAX_DIMENSION)
    expect(Math.abs(width / height - 4032 / 2268)).toBeLessThan(0.01)
  })

  it('rounds to whole pixels', () => {
    // 1000 * (1600 / 3001) = 533.155...
    expect(fitWithin(3001, 1000, 1600)).toEqual({ width: 1600, height: 533 })
    // 1001 * (1600 / 3000) = 533.866...
    expect(fitWithin(3000, 1001, 1600)).toEqual({ width: 1600, height: 534 })
  })

  it('never returns a zero dimension for extreme ratios', () => {
    expect(fitWithin(100000, 10, 1600)).toEqual({ width: 1600, height: 1 })
  })

  it('scales when only one dimension exceeds the max', () => {
    expect(fitWithin(2000, 500, 1600)).toEqual({ width: 1600, height: 400 })
  })
})

describe('targetTypeFor', () => {
  it('keeps GIF as GIF', () => {
    expect(targetTypeFor('image/gif')).toBe('image/gif')
    expect(targetTypeFor('image/gif', false)).toBe('image/gif')
  })

  it('converts JPEG variants to JPEG', () => {
    expect(targetTypeFor('image/jpeg')).toBe('image/jpeg')
    expect(targetTypeFor('image/jpg')).toBe('image/jpeg')
  })

  it('keeps PNG when transparency is present or unknown', () => {
    expect(targetTypeFor('image/png')).toBe('image/png')
    expect(targetTypeFor('image/png', true)).toBe('image/png')
  })

  it('converts opaque PNG to JPEG', () => {
    expect(targetTypeFor('image/png', false)).toBe('image/jpeg')
  })

  it('converts WebP to JPEG unless it has transparency', () => {
    expect(targetTypeFor('image/webp')).toBe('image/jpeg')
    expect(targetTypeFor('image/webp', true)).toBe('image/webp')
  })

  it('ignores the alpha flag for JPEG', () => {
    expect(targetTypeFor('image/jpeg', true)).toBe('image/jpeg')
  })
})

describe('extensionForType', () => {
  it('maps known types', () => {
    expect(extensionForType('image/jpeg')).toBe('jpg')
    expect(extensionForType('image/jpg')).toBe('jpg')
    expect(extensionForType('image/png')).toBe('png')
    expect(extensionForType('image/webp')).toBe('webp')
    expect(extensionForType('image/gif')).toBe('gif')
  })

  it('returns null for unknown types', () => {
    expect(extensionForType('image/heic')).toBeNull()
    expect(extensionForType('')).toBeNull()
  })
})

describe('compressedFileName', () => {
  it('replaces the extension with the target one', () => {
    expect(compressedFileName('IMG_0001.PNG', 'image/jpeg')).toBe('IMG_0001.jpg')
    expect(compressedFileName('photo.jpeg', 'image/jpeg')).toBe('photo.jpg')
    expect(compressedFileName('logo.png', 'image/png')).toBe('logo.png')
  })

  it('only replaces the last extension', () => {
    expect(compressedFileName('my.meal.photo.webp', 'image/jpeg')).toBe('my.meal.photo.jpg')
  })

  it('appends an extension when there is none', () => {
    expect(compressedFileName('photo', 'image/jpeg')).toBe('photo.jpg')
  })

  it('treats a leading dot as part of the name', () => {
    expect(compressedFileName('.hidden', 'image/png')).toBe('.hidden.png')
  })

  it('falls back to a default name and jpg', () => {
    expect(compressedFileName('', 'image/jpeg')).toBe('image.jpg')
    expect(compressedFileName('x.bin', 'application/octet-stream')).toBe('x.jpg')
  })
})
