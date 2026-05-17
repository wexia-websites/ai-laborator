import type { AiWatchItem } from './types'

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'ref',
  'fbclid',
  'gclid',
])

export function normalizeUrlForDedupe(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key)
    }
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const normalized = parsed.toString()
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  } catch {
    return url.trim().toLowerCase()
  }
}

export function mergeAiWatchItems(existing: AiWatchItem[], incoming: AiWatchItem[]): { items: AiWatchItem[]; insertedCount: number } {
  const seen = new Set(existing.map(item => normalizeUrlForDedupe(item.sourceUrl)))
  const merged = [...existing]
  let insertedCount = 0

  for (const item of incoming) {
    const key = normalizeUrlForDedupe(item.sourceUrl)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(item)
    insertedCount++
  }

  merged.sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime())
  return { items: merged, insertedCount }
}
