// Client-side image compression for meal photos (phone photos are several MB each).
// The pure helpers are node-testable; compressImage needs a browser (canvas).

/** Longest edge (px) of an uploaded image after compression. */
export const IMAGE_MAX_DIMENSION = 1600
/** Quality passed to canvas.toBlob for lossy formats (JPEG, WebP). */
export const IMAGE_JPEG_QUALITY = 0.82
/** MIME types accepted by the meal image picker. */
export const IMAGE_ACCEPTED_TYPES: readonly string[] = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
/** Limit for the file the user selects (before compression). */
export const IMAGE_MAX_INPUT_BYTES = 5 * 1024 * 1024
/** Files below this size whose dimensions already fit are uploaded as-is. */
export const IMAGE_SKIP_BELOW_BYTES = 300 * 1024

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Scale (width, height) down proportionally so both fit within max. Never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height }
  const scale = max / Math.max(width, height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Output MIME type for an input type.
 * - GIF stays GIF (it is never re-encoded, to keep animation).
 * - PNG / WebP with transparency keep their format (JPEG has no alpha).
 *   For PNG, transparency is assumed when unknown.
 * - Everything else becomes JPEG.
 */
export function targetTypeFor(inputType: string, hasAlpha: boolean = inputType === 'image/png'): string {
  if (inputType === 'image/gif') return 'image/gif'
  if (hasAlpha && (inputType === 'image/png' || inputType === 'image/webp')) return inputType
  return 'image/jpeg'
}

/** File extension (without dot) for a MIME type, or null if unknown. */
export function extensionForType(type: string): string | null {
  return EXTENSION_BY_TYPE[type] ?? null
}

/** Original base name with the extension replaced to match targetType ("IMG_0001.PNG" -> "IMG_0001.jpg"). */
export function compressedFileName(originalName: string, targetType: string): string {
  const ext = extensionForType(targetType) ?? 'jpg'
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  return `${base || 'image'}.${ext}`
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    let bitmap: ImageBitmap | null = null
    try {
      // Apply EXIF orientation (phone photos are often stored rotated)
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      try {
        bitmap = await createImageBitmap(file)
      } catch {
        bitmap = null
      }
    }
    if (bitmap) {
      const b = bitmap
      return { source: b, width: b.width, height: b.height, close: () => b.close() }
    }
  }

  // Fallback: <img> (browsers apply EXIF orientation to images by default)
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = ctx.getImageData(0, 0, width, height).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

/**
 * Downscale and re-encode an image before upload. Returns the original file when
 * it is a GIF, already small, or when anything fails / the result would be larger.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file
  if (typeof document === 'undefined') return file

  let decoded: Decoded | null = null
  try {
    decoded = await decode(file)
    const { width, height } = decoded
    if (!width || !height) return file

    const fitsAlready = width <= IMAGE_MAX_DIMENSION && height <= IMAGE_MAX_DIMENSION
    if (fitsAlready && file.size < IMAGE_SKIP_BELOW_BYTES) return file

    const size = fitWithin(width, height, IMAGE_MAX_DIMENSION)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(decoded.source, 0, 0, size.width, size.height)

    const mayHaveAlpha = file.type === 'image/png' || file.type === 'image/webp'
    const hasAlpha = mayHaveAlpha && canvasHasAlpha(ctx, size.width, size.height)
    const targetType = targetTypeFor(file.type, hasAlpha)

    if (targetType === 'image/jpeg' && mayHaveAlpha) {
      // Opaque image from a format with alpha: paint onto white so JPEG has no black edges
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, size.width, size.height)
      ctx.globalCompositeOperation = 'source-over'
    }

    const blob = await toBlob(canvas, targetType, IMAGE_JPEG_QUALITY)
    // Some browsers silently fall back to PNG for unsupported types
    if (!blob || blob.type !== targetType || blob.size >= file.size) return file

    return new File([blob], compressedFileName(file.name, targetType), {
      type: targetType,
      lastModified: file.lastModified,
    })
  } catch (error) {
    console.warn('Image compression failed, uploading original:', error)
    return file
  } finally {
    decoded?.close()
  }
}
