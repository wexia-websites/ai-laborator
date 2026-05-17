export type AiWatchCategory = 'tool' | 'breaking' | 'hidden_gem' | 'infra' | 'tip'
export type AiWatchPriority = 'high' | 'medium' | 'low'
export type AiWatchConfidence = 'high' | 'medium' | 'low'
export type AiWatchSourceType = 'openai_web_search' | 'github' | 'huggingface' | 'hn' | 'reddit' | 'blog' | 'vendor' | 'other'
export type AiWatchRunStatus = 'running' | 'success' | 'failed' | 'no_news'
export type AiWatchRunTrigger = 'manual' | 'cron'

export type AiWatchItem = {
  id: string
  title: string
  sourceUrl: string
  sourceDomain: string
  sourceType: AiWatchSourceType
  category: AiWatchCategory
  summary: string
  whyItMatters: string
  apiIntegrations: string
  pricingLicense: string
  priority: AiWatchPriority
  confidence: AiWatchConfidence
  tags: string[]
  topicKeywords: string[]
  entityNames: string[]
  imageUrl: string | null
  publishedAt: string | null
  discoveredAt: string
  archivedAt: string | null
  userRating: -1 | 0 | 1 | null
}

export type AiWatchRun = {
  id: string
  status: AiWatchRunStatus
  startedAt: string
  finishedAt: string | null
  model: string
  promptVersion: string
  source: 'openai_responses_web_search'
  trigger: AiWatchRunTrigger
  candidateCount: number
  insertedCount: number
  filteredCount: number
  error: string | null
}

export type AiWatchFeed = {
  items: AiWatchItem[]
  runs: AiWatchRun[]
}

export type AiWatchSkipList = {
  topicKeywords: string[]
  entityNames: string[]
  urls: string[]
}

export type OpenAiAiNewsItem = {
  title: string
  sourceUrl: string
  sourceDomain: string | null
  sourceType: string | null
  category: AiWatchCategory
  summary: string
  whyItMatters: string | null
  apiIntegrations: string | null
  pricingLicense: string | null
  priority: AiWatchPriority
  confidence: AiWatchConfidence
  tags: string[]
  topicKeywords: string[]
  entityNames: string[]
  publishedAt: string | null
}

export type OpenAiAiNewsPayload = {
  generatedAt: string
  querySummary: string
  items: OpenAiAiNewsItem[]
}
