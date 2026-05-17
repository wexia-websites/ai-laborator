import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { useCaseId } = await req.json()
  if (!useCaseId) return NextResponse.json({ error: 'missing useCaseId' }, { status: 400 })

  const webhookUrl = process.env.MAKE_WEBHOOK_URL
  if (!webhookUrl) return NextResponse.json({ success: true, skipped: true })

  const { data: uc, error } = await supabase
    .from('use_cases')
    .select('*')
    .eq('id', useCaseId)
    .single()

  if (error || !uc) return NextResponse.json({ error: 'use case not found' }, { status: 404 })

  const payload = {
    id: uc.id,
    title: uc.title,
    tool_name: uc.tool_name,
    description: uc.description,
    purpose: uc.purpose,
    team: uc.team,
    author_name: uc.author_name,
    rating: uc.rating ?? 0,
    recommended: uc.recommended,
    category: uc.category,
    tags: uc.tags ?? [],
    effort: uc.effort,
    impact: uc.impact,
    similar_tools: uc.similar_tools,
    best_for_roles: uc.best_for_roles,
    time_saved: uc.time_saved,
    aha_moment: uc.aha_moment,
    onboarding_score: uc.onboarding_score ?? 0,
    ui_intuitive: uc.ui_intuitive,
    output_quality: uc.output_quality,
    hallucinates: uc.hallucinates,
    weaknesses: uc.weaknesses,
    security_risks: uc.security_risks,
    limitations: uc.limitations,
    pricing: uc.pricing,
    confidence_score: uc.confidence_score ?? 0,
    published_at: uc.updated_at ?? new Date().toISOString(),
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    return NextResponse.json({ error: `webhook returned ${res.status}` }, { status: 502 })
  }

  return NextResponse.json({ success: true })
}
