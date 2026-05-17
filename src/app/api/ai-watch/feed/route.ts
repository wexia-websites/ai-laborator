import { NextResponse } from 'next/server'
import { listAiWatchFeed } from '@/lib/ai-watch/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const feed = await listAiWatchFeed()
    return NextResponse.json({
      ok: true,
      items: feed.items,
      runs: feed.runs.slice(0, 20),
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error), items: [], runs: [] },
      { status: 500 },
    )
  }
}
