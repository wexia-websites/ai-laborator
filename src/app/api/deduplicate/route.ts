import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function isSimilar(a: string, b: string): boolean {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  if (
    Math.abs(na.length - nb.length) < 3 &&
    na.replace(/\s/g, '') === nb.replace(/\s/g, '')
  ) return true
  return false
}

export async function POST() {
  try {
    const { data: tools, error } = await supabase
      .from('tools')
      .select('id, name, vendor, created_at')
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!tools || tools.length === 0) return NextResponse.json({ deleted: 0 })

    const keep = new Set<string>()
    const toDelete: string[] = []

    for (const tool of tools) {
      const isDuplicate = Array.from(keep).some(keptId => {
        const kept = tools.find((t: { id: string }) => t.id === keptId)!
        return isSimilar(kept.name, tool.name)
      })

      if (isDuplicate) {
        toDelete.push(tool.id)
      } else {
        keep.add(tool.id)
      }
    }

    if (toDelete.length > 0) {
      const { error: delError } = await supabase
        .from('tools')
        .delete()
        .in('id', toDelete)

      if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: toDelete.length })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
