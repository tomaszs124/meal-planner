/**
 * Lowercased, accent-insensitive word stems (first 5 chars of words with at least
 * 3 chars). Good enough to match Polish inflections and hyphenated names:
 * "musztardowo-miodowej" -> ["muszt", "miodo"].
 */
export function stems(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
    .map((w) => w.slice(0, 5))
}

/** Number of query stems present in the text stems (0 = no match). */
export function stemOverlap(query: string, text: string): number {
  const wanted = Array.from(new Set(stems(query)))
  if (wanted.length === 0) return 0
  const hay = new Set(stems(text))
  return wanted.filter((w) => hay.has(w)).length
}
