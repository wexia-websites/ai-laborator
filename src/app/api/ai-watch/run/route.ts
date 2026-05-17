import { NextRequest, NextResponse } from 'next/server'
import { dropLowQuality, fetchAiNewsFromOpenAI, type AiWatchMode } from '@/lib/ai-watch/openai'
import {
  createAiWatchRun,
  getActiveStore,
  getSkipList,
  insertAiWatchItems,
  readAiWatchItems,
  saveAiWatchRun,
} from '@/lib/ai-watch/store'
import { flushLangfuse, getLangfuse } from '@/lib/langfuse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SKIP_DAYS = Number.parseInt(process.env.AI_WATCH_SKIP_DAYS ?? '90', 10) || 90

function detectTrigger(request: NextRequest): 'manual' | 'cron' {
  if (request.headers.get('x-vercel-cron-id')) return 'cron'
  return 'manual'
}

function isAuthorized(request: NextRequest, trigger: 'manual' | 'cron'): boolean {
  const secret = process.env.AI_WATCH_CRON_SECRET ?? process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''

  if (trigger === 'cron') {
    if (!secret) return process.env.NODE_ENV !== 'production'
    return header === `Bearer ${secret}`
  }

  if (!secret && process.env.NODE_ENV !== 'production') return true
  if (!secret) return false
  return header === `Bearer ${secret}`
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    source: 'openai_responses_web_search',
    model: process.env.OPENAI_MODEL ?? 'gpt-5.4',
    store: getActiveStore(),
    skipDays: SKIP_DAYS,
    langfuse: Boolean(getLangfuse()),
  })
}

export async function POST(request: NextRequest) {
  const trigger = detectTrigger(request)

  if (!isAuthorized(request, trigger)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // mode: ?mode=tools nebo body { mode }. Default = news.
  const url = new URL(request.url)
  const queryMode = url.searchParams.get('mode')
  let bodyMode: string | null = null
  try {
    const body = await request.clone().json().catch(() => null) as { mode?: string } | null
    bodyMode = body?.mode ?? null
  } catch { /* no body, fine */ }
  const mode: AiWatchMode = (queryMode === 'tools' || bodyMode === 'tools') ? 'tools' : 'news'

  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL ?? 'gpt-5.4'
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is missing' }, { status: 500 })
  }

  const run = createAiWatchRun(model, trigger)
  await saveAiWatchRun(run)

  const lf = getLangfuse()
  const trace = lf?.trace({
    name: mode === 'tools' ? 'ai_tools_discovery' : 'ai_watch_ingest',
    sessionId: run.id,
    tags: ['ai-watch', trigger, mode],
    metadata: {
      runId: run.id,
      trigger,
      mode,
      store: getActiveStore(),
      model,
      skipDays: SKIP_DAYS,
    },
  })

  try {
    const skipList = await getSkipList(SKIP_DAYS)
    trace?.update({
      input: {
        mode,
        skipList: {
          topicKeywords: skipList.topicKeywords.length,
          entityNames: skipList.entityNames.length,
          urls: skipList.urls.length,
        },
      },
    })

    const { items: candidates, usage } = await fetchAiNewsFromOpenAI({ apiKey, model, skipList, trace, mode })
    const { kept, dropped } = dropLowQuality(candidates)

    const merged = kept.length > 0
      ? await insertAiWatchItems(kept)
      : { items: await readAiWatchItems(), insertedCount: 0 }

    const status: 'success' | 'no_news' = merged.insertedCount === 0 ? 'no_news' : 'success'

    const finished = {
      ...run,
      status,
      finishedAt: new Date().toISOString(),
      candidateCount: candidates.length,
      insertedCount: merged.insertedCount,
      filteredCount: dropped.length,
    }
    await saveAiWatchRun(finished)

    trace?.update({
      output: {
        status,
        candidateCount: candidates.length,
        keptCount: kept.length,
        droppedLowQuality: dropped.length,
        insertedCount: merged.insertedCount,
        usage,
      },
    })
    await flushLangfuse()

    return NextResponse.json({
      ok: true,
      run: finished,
      insertedCount: merged.insertedCount,
      candidateCount: candidates.length,
      filteredCount: dropped.length,
      skipList: { topicKeywords: skipList.topicKeywords.length, entityNames: skipList.entityNames.length, urls: skipList.urls.length },
      items: merged.items.slice(0, 20),
    })
  } catch (error) {
    const failed = {
      ...run,
      status: 'failed' as const,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    }
    await saveAiWatchRun(failed)
    trace?.update({ output: { status: 'failed', error: failed.error } })
    await flushLangfuse()
    return NextResponse.json({ error: failed.error, run: failed }, { status: 500 })
  }
}
