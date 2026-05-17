import type { AiWatchItem } from './types'
import { normalizeUrlForDedupe } from './storeHelpers'

export type AiWatchInboxTool = {
  id: string
  name: string
  vendor: string
  website_url: string
  description: string
  category: string
  tags: string[]
  status: 'new' | 'claimed' | 'in_progress' | 'completed' | 'archived'
  legit_score: number
  fit_score: number
  novelty_score: number
  source: string
  claimed_by: string | null
  claimed_at: string | null
  created_at: string
  is_new?: boolean
  ai_watch_id?: string
  ai_watch_priority?: string
  ai_watch_confidence?: string
  pricing_license?: string
  api_integrations?: string
}

export type ExistingInboxTool = {
  id?: string
  website_url?: string | null
  sourceUrl?: string | null
}

function scorePriority(priority: AiWatchItem['priority']) {
  if (priority === 'high') return 95
  if (priority === 'medium') return 75
  return 55
}

function scoreConfidence(confidence: AiWatchItem['confidence']) {
  if (confidence === 'high') return 90
  if (confidence === 'medium') return 72
  return 55
}

function scoreNovelty(item: AiWatchItem) {
  if (item.category === 'hidden_gem') return 90
  return item.priority === 'high' ? 70 : 58
}

export function isTestableCompanyTool(item: AiWatchItem): boolean {
  if (item.category !== 'tool' && item.category !== 'hidden_gem') return false

  const text = `${item.title} ${item.summary} ${item.whyItMatters} ${item.tags.join(' ')}`.toLowerCase()
  const domain = (item.sourceDomain ?? '').toLowerCase()
  const url = (item.sourceUrl ?? '').toLowerCase()

  // Negative gates: announcements/news/finance even if model mislabeled category=tool
  const isFinanceOrCompanyNews = /\bipo\b|příjm|financ|funding|raises|akvizic|acquires|valuaci|valuation/.test(text)
  const isModelAnnouncement = /(uvádí|představuje|launches|releases|introduces).{0,80}\b(model|gemini|claude|gpt|llama|mistral)\b/.test(text)
  const isConceptOrEventNews = /cloud next|škálování|scaling|infrastrukturu|infrastructure/.test(text)

  if (isFinanceOrCompanyNews || isModelAnnouncement || isConceptOrEventNews) return false

  // Positive: dev-tool domains are an immediate accept.
  // Match against domain (exact) or substring in URL — keeps simple, no boundary tricks.
  const isDevToolDomain =
    /^(?:[\w-]+\.)?(?:github\.com|huggingface\.co|npmjs\.com|pypi\.org|crates\.io|hex\.pm|brew\.sh)$/.test(domain)
    || /chrome\.google\.com\/webstore|chromewebstore\.google\.com|marketplace\.visualstudio\.com|plugins\.jetbrains\.com/.test(url)
  if (isDevToolDomain) return true

  // Positive textual surface — broader than v1 regex (added \btool\b, \bapp\b, cli, sdk, library, knihovn, repo, server, chrome, vscode, …)
  const hasCompanyTestingSurface = /\btool\b|toolkit|\bkit\b|\bapp\b|cli\b|\bsdk\b|library|knihovn|nástroj|aplikac|platform|workflow|automatiz|agent|mcp|\bapi\b|ocr|browser|prohlížeč|integrac|governance|dashboard|plugin|extension|ide\b|repo\b|server|chrome|vs code|vscode|jetbrains|cursor|copilot|model context protocol/.test(text)
  return hasCompanyTestingSurface
}

function uniqueTags(tags: string[]) {
  const seen = new Set<string>()
  return tags
    .map(tag => tag.trim())
    .filter(Boolean)
    .filter(tag => {
      const key = tag.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)
}

function compactText(parts: Array<string | null | undefined>) {
  return parts
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part && part !== 'neuvedeno'))
    .join('\n\n')
}

function cleanupToolName(name: string) {
  return name
    .replace(/\s+\d{4,}(?:\.\d+)*(?:\.\d+)?$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function deriveInboxToolName(title: string): string {
  const normalized = title.replace(/\s+/g, ' ').trim()
  const afterColon = normalized.includes(':') ? normalized.split(':').slice(1).join(':').trim() : normalized

  const announcementMatch = afterColon.match(/(?:^|\s)(?:představuje|uvádí|spouští|launches|releases|introduces)\s+(.+)$/i)
  let candidate = announcementMatch?.[1] ?? afterColon

  candidate = candidate
    .replace(/\s+s\s+modelem\b.*$/i, '')
    .replace(/\s+with\s+model\b.*$/i, '')
    .replace(/\s+pro\s+(?:podnikové|firemní|interní|týmy|firmy).*$/i, '')
    .replace(/\s+for\s+(?:enterprise|business|teams).*$/i, '')
    .replace(/\s+\d{4,}(?:\.\d+)*(?:\.\d+)?(?=\s+přidává)/i, '')
    .replace(/\s+přidává.*$/i, '')

  return cleanupToolName(candidate) || normalized
}

export function aiWatchItemToInboxTool(item: AiWatchItem): AiWatchInboxTool {
  const testingDescription = item.whyItMatters && item.whyItMatters !== 'neuvedeno'
    ? item.whyItMatters
    : item.summary

  return {
    id: `ai-watch-${item.id}`,
    name: deriveInboxToolName(item.title),
    vendor: item.sourceDomain ?? new URL(item.sourceUrl).hostname.replace(/^www\./, ''),
    website_url: item.sourceUrl,
    description: compactText([`Co otestovat: ${testingDescription}`]),
    category: item.category,
    tags: uniqueTags(item.tags),
    status: 'new',
    legit_score: scoreConfidence(item.confidence),
    fit_score: scorePriority(item.priority),
    novelty_score: scoreNovelty(item),
    source: 'ai_watch',
    claimed_by: null,
    claimed_at: null,
    created_at: item.discoveredAt,
    is_new: true,
    ai_watch_id: item.id,
    ai_watch_priority: item.priority,
    ai_watch_confidence: item.confidence,
    pricing_license: item.pricingLicense,
    api_integrations: item.apiIntegrations,
  }
}

export function mergeAiWatchToolsIntoInbox(existingTools: ExistingInboxTool[], aiWatchItems: AiWatchItem[]): AiWatchInboxTool[] {
  const existingUrls = new Set(
    existingTools
      .map(tool => tool.website_url ?? tool.sourceUrl ?? null)
      .filter((url): url is string => Boolean(url))
      .map(normalizeUrlForDedupe),
  )

  return aiWatchItems
    .filter(isTestableCompanyTool)
    .filter(item => !existingUrls.has(normalizeUrlForDedupe(item.sourceUrl)))
    .map(aiWatchItemToInboxTool)
}
