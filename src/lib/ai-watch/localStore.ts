import 'server-only'

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AiWatchItem, AiWatchRun, AiWatchRunTrigger, AiWatchSkipList } from './types'
import { mergeAiWatchItems } from './storeHelpers'
import { AI_WATCH_PROMPT_VERSION } from './openai'

const DATA_DIR = process.env.AI_WATCH_LOCAL_DATA_DIR
  ? path.resolve(process.env.AI_WATCH_LOCAL_DATA_DIR)
  : path.join(process.cwd(), 'data', 'ai-watch')

const ITEMS_PATH = path.join(DATA_DIR, 'items.json')
const RUNS_PATH = path.join(DATA_DIR, 'runs.json')
let storeLock: Promise<void> = Promise.resolve()

async function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = storeLock
  let release!: () => void
  storeLock = new Promise<void>(resolve => { release = resolve })
  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true })
}

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function writeJsonArray<T>(filePath: string, data: T[]) {
  await ensureDir()
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await rename(tmp, filePath)
}

function normalizeItemShape(raw: AiWatchItem & Partial<{ topicKeywords: string[]; entityNames: string[]; imageUrl: string | null; archivedAt: string | null; userRating: -1|0|1|null }>): AiWatchItem {
  return {
    ...raw,
    topicKeywords: Array.isArray(raw.topicKeywords) ? raw.topicKeywords : [],
    entityNames: Array.isArray(raw.entityNames) ? raw.entityNames : [],
    imageUrl: raw.imageUrl ?? null,
    archivedAt: raw.archivedAt ?? null,
    userRating: raw.userRating ?? null,
  }
}

export async function readAiWatchItems(): Promise<AiWatchItem[]> {
  const items = await readJsonArray<AiWatchItem>(ITEMS_PATH)
  return items
    .map(normalizeItemShape)
    .filter(item => !item.archivedAt)
    .sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime())
}

export async function readAiWatchRuns(): Promise<AiWatchRun[]> {
  const runs = await readJsonArray<AiWatchRun>(RUNS_PATH)
  return runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

export async function saveAiWatchRun(run: AiWatchRun): Promise<void> {
  await withStoreLock(async () => {
    const runs = await readAiWatchRuns()
    const withoutOld = runs.filter(existing => existing.id !== run.id)
    await writeJsonArray(RUNS_PATH, [run, ...withoutOld].slice(0, 100))
  })
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
  return withStoreLock(async () => {
    const existing = await readAiWatchItems()
    const merged = mergeAiWatchItems(existing, incoming)
    await writeJsonArray(ITEMS_PATH, merged.items)
    return merged
  })
}

export async function listAiWatchFeed(): Promise<{ items: AiWatchItem[]; runs: AiWatchRun[] }> {
  const [items, runs] = await Promise.all([readAiWatchItems(), readAiWatchRuns()])
  return { items, runs }
}

export async function getSkipList(skipDays: number): Promise<AiWatchSkipList> {
  const cutoff = Date.now() - skipDays * 86_400_000
  const items = (await readAiWatchItems()).filter(item => {
    const ts = new Date(item.discoveredAt).getTime()
    return Number.isFinite(ts) && ts >= cutoff
  })

  const topicSet = new Set<string>()
  const urlSet = new Set<string>()

  for (const item of items) {
    item.topicKeywords.forEach(k => topicSet.add(k))
    urlSet.add(item.sourceUrl)
  }

  // entity_names jsou per-item metadata, ne skip signal — viz supabaseStore.getSkipList
  return {
    topicKeywords: [...topicSet],
    entityNames: [],
    urls: [...urlSet],
  }
}
