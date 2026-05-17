import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import type {
  AiWatchItem,
  AiWatchRun,
  AiWatchRunStatus,
  AiWatchRunTrigger,
  AiWatchSkipList,
  AiWatchCategory,
  AiWatchPriority,
  AiWatchConfidence,
  AiWatchSourceType,
} from './types'
import { mergeAiWatchItems } from './storeHelpers'
import { AI_WATCH_PROMPT_VERSION } from './openai'

let cached: SupabaseClient | null = null

function adminClient(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing')
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing (server-side write needs it; get it from Supabase Studio → Settings → API)')
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

type ItemRow = {
  id: string
  title: string
  source_url: string
  source_domain: string
  source_type: string
  category: string
  summary: string
  why_it_matters: string
  api_integrations: string
  pricing_license: string
  priority: string
  confidence: string
  tags: string[] | null
  topic_keywords: string[] | null
  entity_names: string[] | null
  image_url: string | null
  published_at: string | null
  discovered_at: string
  archived_at: string | null
  user_rating: number | null
}

type RunRow = {
  id: string
  status: string
  started_at: string
  finished_at: string | null
  model: string
  prompt_version: string
  source: string
  trigger: string
  candidate_count: number
  inserted_count: number
  filtered_count: number
  error: string | null
}

function rowToItem(row: ItemRow): AiWatchItem {
  return {
    id: row.id,
    title: row.title,
    sourceUrl: row.source_url,
    sourceDomain: row.source_domain,
    sourceType: row.source_type as AiWatchSourceType,
    category: row.category as AiWatchCategory,
    summary: row.summary,
    whyItMatters: row.why_it_matters,
    apiIntegrations: row.api_integrations,
    pricingLicense: row.pricing_license,
    priority: row.priority as AiWatchPriority,
    confidence: row.confidence as AiWatchConfidence,
    tags: row.tags ?? [],
    topicKeywords: row.topic_keywords ?? [],
    entityNames: row.entity_names ?? [],
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    discoveredAt: row.discovered_at,
    archivedAt: row.archived_at,
    userRating: row.user_rating === -1 || row.user_rating === 0 || row.user_rating === 1 ? row.user_rating : null,
  }
}

function itemToRow(item: AiWatchItem): Omit<ItemRow, 'created_at' | 'updated_at'> {
  return {
    id: item.id,
    title: item.title,
    source_url: item.sourceUrl,
    source_domain: item.sourceDomain,
    source_type: item.sourceType,
    category: item.category,
    summary: item.summary,
    why_it_matters: item.whyItMatters,
    api_integrations: item.apiIntegrations,
    pricing_license: item.pricingLicense,
    priority: item.priority,
    confidence: item.confidence,
    tags: item.tags,
    topic_keywords: item.topicKeywords,
    entity_names: item.entityNames,
    image_url: item.imageUrl,
    published_at: item.publishedAt,
    discovered_at: item.discoveredAt,
    archived_at: item.archivedAt,
    user_rating: item.userRating,
  }
}

function rowToRun(row: RunRow): AiWatchRun {
  return {
    id: row.id,
    status: row.status as AiWatchRunStatus,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    model: row.model,
    promptVersion: row.prompt_version,
    source: row.source as 'openai_responses_web_search',
    trigger: row.trigger as AiWatchRunTrigger,
    candidateCount: row.candidate_count,
    insertedCount: row.inserted_count,
    filteredCount: row.filtered_count,
    error: row.error,
  }
}

function runToRow(run: AiWatchRun): RunRow {
  return {
    id: run.id,
    status: run.status,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    model: run.model,
    prompt_version: run.promptVersion,
    source: run.source,
    trigger: run.trigger,
    candidate_count: run.candidateCount,
    inserted_count: run.insertedCount,
    filtered_count: run.filteredCount,
    error: run.error,
  }
}

export async function readAiWatchItems(): Promise<AiWatchItem[]> {
  const { data, error } = await adminClient()
    .from('ai_watch_items')
    .select('*')
    .is('archived_at', null)
    .order('discovered_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(`readAiWatchItems: ${error.message}`)
  return (data as ItemRow[] | null ?? []).map(rowToItem)
}

export async function readAiWatchRuns(): Promise<AiWatchRun[]> {
  const { data, error } = await adminClient()
    .from('ai_watch_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(50)
  if (error) throw new Error(`readAiWatchRuns: ${error.message}`)
  return (data as RunRow[] | null ?? []).map(rowToRun)
}

export async function saveAiWatchRun(run: AiWatchRun): Promise<void> {
  const { error } = await adminClient()
    .from('ai_watch_runs')
    .upsert(runToRow(run), { onConflict: 'id' })
  if (error) throw new Error(`saveAiWatchRun: ${error.message}`)
}

export function createAiWatchRun(model: string, trigger: AiWatchRunTrigger = 'manual'): AiWatchRun {
  return {
    id: randomUUID(),
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    model,
    promptVersion: AI_WATCH_PROMPT_VERSION,
    source: 'openai_responses_web_search',
    trigger,
    candidateCount: 0,
    insertedCount: 0,
    filteredCount: 0,
    error: null,
  }
}

export async function insertAiWatchItems(incoming: AiWatchItem[]): Promise<{ items: AiWatchItem[]; insertedCount: number }> {
  if (incoming.length === 0) {
    const items = await readAiWatchItems()
    return { items, insertedCount: 0 }
  }
  const existing = await readAiWatchItems()
  const merged = mergeAiWatchItems(existing, incoming)

  // Only insert the new ones; existing rows are untouched.
  const existingIds = new Set(existing.map(item => item.id))
  const toInsert = merged.items.filter(item => !existingIds.has(item.id))

  if (toInsert.length > 0) {
    const { error } = await adminClient()
      .from('ai_watch_items')
      .upsert(toInsert.map(itemToRow), { onConflict: 'id' })
    if (error) throw new Error(`insertAiWatchItems: ${error.message}`)
  }

  return merged
}

export async function listAiWatchFeed(): Promise<{ items: AiWatchItem[]; runs: AiWatchRun[] }> {
  const [items, runs] = await Promise.all([readAiWatchItems(), readAiWatchRuns()])
  return { items, runs }
}

export async function getSkipList(skipDays: number): Promise<AiWatchSkipList> {
  const cutoff = new Date(Date.now() - skipDays * 86_400_000).toISOString()
  const { data, error } = await adminClient()
    .from('ai_watch_items')
    .select('source_url, topic_keywords')
    .is('archived_at', null)
    .gte('discovered_at', cutoff)
  if (error) throw new Error(`getSkipList: ${error.message}`)

  const topicSet = new Set<string>()
  const urlSet = new Set<string>()
  for (const row of (data ?? []) as Pick<ItemRow, 'source_url' | 'topic_keywords'>[]) {
    ;(row.topic_keywords ?? []).forEach(k => topicSet.add(k))
    if (row.source_url) urlSet.add(row.source_url)
  }
  // entity_names jsou per-item metadata pro UI/filtraci, NE skip signal —
  // jejich úroveň granularity (např. "OpenAI") by ban-ovala celé firmy.
  return {
    topicKeywords: [...topicSet],
    entityNames: [],
    urls: [...urlSet],
  }
}
