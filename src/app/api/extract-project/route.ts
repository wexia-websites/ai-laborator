import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `Z konverzace extrahuj zpětnou analýzu projektu. Vrať POUZE validní JSON, bez markdown backticks:
{
  "title": "Název projektu nebo 'Projekt: hlavní téma' — konkrétní, nikdy generický",
  "description": "1–2 věty shrnutí",
  "client": "Klient nebo interní nebo null",
  "team": "Tým nebo null",
  "duration": "Délka projektu nebo null",
  "start_date": "Datum začátku ve formátu YYYY-MM-DD nebo null pokud není zmíněno",
  "end_date": "Datum konce ve formátu YYYY-MM-DD nebo null pokud projekt stále probíhá nebo datum není zmíněno",
  "project_type": "internal nebo external — dle toho zda byl projekt pro firmu nebo pro externího klienta",
  "tools_used": "Čárkou oddělený seznam AI nástrojů použitých v projektu",
  "project_goal": "Cíl projektu",
  "what_worked": "Co fungovalo skvěle",
  "what_failed": "Co nešlo podle plánu nebo zklamalo",
  "challenges": "Největší výzvy a překážky, které se vyskytly během projektu",
  "lessons_learned": "Poučení z projektu",
  "avoid_next_time": "Čemu se příště vyvarovat",
  "process_that_worked": "Postup který se osvědčil",
  "ai_contribution": "Jak AI přispěla k výsledku",
  "reusable": "yes nebo yes_with_changes nebo no — doporučuje se tento přístup jako mustr pro podobné projekty",
  "recommendations": "Doporučení pro ostatní, kdo budou dělat podobný projekt nebo null",
  "tool_ratings": [{"tool": "název nástroje", "rating": 8, "note": "krátký komentář"}],
  "overall_rating": "číslo 1–10 nebo null",
  "would_repeat": "Zopakoval/a bys stejný přístup a co by bylo jinak",
  "status": "draft"
}`,
      messages: [{
        role: 'user',
        content: messages
          .map((m: { role: string; content: string }) =>
            `${m.role === 'user' ? 'Uživatel' : 'AI'}: ${m.content}`)
          .join('\n\n')
      }]
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const data = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 })
  }
}
