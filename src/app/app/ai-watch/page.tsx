'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRole } from '@/lib/useRole'
import type { AiWatchItem, AiWatchRun } from '@/lib/ai-watch/types'

type FeedResponse = {
  ok: boolean
  items: AiWatchItem[]
  runs: AiWatchRun[]
  error?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  tool: 'Nástroj',
  breaking: 'Breaking',
  hidden_gem: 'Hidden gem',
  infra: 'Infra',
  tip: 'Tip',
}

const PRIORITY_CLASS: Record<string, string> = {
  high: 'tag-amber',
  medium: 'tag-green',
  low: '',
}

const RUN_STATUS_LABELS: Record<string, string> = {
  running: 'běží',
  success: 'OK',
  no_news: 'nic nového',
  failed: 'chyba',
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'neuvedeno'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'neuvedeno'
  return new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function AiWatchPage() {
  const router = useRouter()
  const { canAccess, loading: roleLoading } = useRole()
  const [items, setItems] = useState<AiWatchItem[]>([])
  const [runs, setRuns] = useState<AiWatchRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [priority, setPriority] = useState('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!roleLoading && !canAccess('ai-watch')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-watch/feed', { cache: 'no-store' })
      const json = await res.json() as FeedResponse
      if (!json.ok) throw new Error(json.error ?? 'Feed se nepodařilo načíst')
      setItems(json.items ?? [])
      setRuns(json.runs ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const runIngest = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-watch/run', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'AI News ingest selhal')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter(item => {
      if (category !== 'all' && item.category !== category) return false
      if (priority !== 'all' && item.priority !== priority) return false
      if (!needle) return true
      return [
        item.title,
        item.summary,
        item.whyItMatters,
        item.sourceDomain,
        item.apiIntegrations,
        item.pricingLicense,
        ...item.tags,
        ...item.topicKeywords,
        ...item.entityNames,
      ].some(value => value?.toLowerCase().includes(needle))
    })
  }, [items, q, category, priority])

  const latestRun = runs[0]
  const highCount = items.filter(item => item.priority === 'high').length
  const toolCount = items.filter(item => item.category === 'tool' || item.category === 'hidden_gem').length

  return (
    <>
      <div className="page-header">
        <div>
          <h1>AI News feed</h1>
          <p>Denní kurátorský brief pro AI-first firmu. Cron běží každý den v 06:00 CET, anti-duplicity přes 90denní paměť.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={load} disabled={loading || running}>Obnovit</button>
          <button className="btn btn-primary" onClick={runIngest} disabled={running}>
            {running ? '⟳ OpenAI hledá…' : '⟳ Spustit ingest teď'}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Položky ve feedu</div>
            <div className="stat-value">{items.length}</div>
            <div className="stat-sub">Supabase, posledních 30 dní</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">High priority</div>
            <div className="stat-value">{highCount}</div>
            <div className="stat-sub">stojí za rychlé otestování</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tools + gems</div>
            <div className="stat-value">{toolCount}</div>
            <div className="stat-sub">praktické nástroje</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Poslední ingest</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{latestRun ? RUN_STATUS_LABELS[latestRun.status] ?? latestRun.status : '—'}</div>
            <div className="stat-sub">
              {latestRun
                ? `${formatDate(latestRun.finishedAt ?? latestRun.startedAt)} · ${latestRun.trigger}${latestRun.insertedCount > 0 ? ` · +${latestRun.insertedCount}` : ''}${latestRun.filteredCount > 0 ? ` · filtr ${latestRun.filteredCount}` : ''}`
                : 'zatím neběžel'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input className="search-box" placeholder="Hledat ve feedu…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: '1 1 260px', marginBottom: 0 }} />
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} style={{ width: 170 }}>
            <option value="all">Všechny kategorie</option>
            <option value="tool">Nástroje</option>
            <option value="hidden_gem">Hidden gems</option>
            <option value="breaking">Breaking</option>
            <option value="infra">Infra</option>
            <option value="tip">Tipy</option>
          </select>
          <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)} style={{ width: 150 }}>
            <option value="all">Všechny priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {error && (
          <div className="empty" style={{ marginBottom: 14, borderColor: '#7f1d1d' }}>
            <span className="empty-icon">⚠️</span>{error}
          </div>
        )}

        {loading ? (
          <div className="empty"><span className="empty-icon">⟳</span>Načítám AI News feed…</div>
        ) : items.length === 0 && latestRun?.status === 'no_news' ? (
          <div className="empty">
            <span className="empty-icon">🌙</span>
            Dnes nic skutečně nového. Příští automatická kontrola zítra v 06:00 CET.
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty"><span className="empty-icon">🛰️</span>Feed je prázdný. Spusť ingest, nebo počkej na ranní cron.</div>
        ) : filtered.map(item => (
          <div key={item.id} className="tool-card" style={{ borderLeft: item.priority === 'high' ? '3px solid #f59e0b' : 'none' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="tool-name">{item.title}</div>
                <span className={`tag ${PRIORITY_CLASS[item.priority] ?? ''}`}>{item.priority}</span>
                <span className="tag tag-violet">{CATEGORY_LABELS[item.category] ?? item.category}</span>
                <span className="tag">confidence {item.confidence}</span>
              </div>
              <div className="tool-vendor">
                {item.entityNames.length > 0 ? <strong>{item.entityNames.join(' · ')}</strong> : item.sourceDomain}
                {item.entityNames.length > 0 && <span> · {item.sourceDomain}</span>}
                {' · '}publikováno {formatDate(item.publishedAt)} · nalezeno {formatDate(item.discoveredAt)} · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">zdroj ↗</a>
              </div>
              <div className="tool-desc" style={{ marginBottom: 8 }}>{item.summary}</div>
              {item.whyItMatters !== 'neuvedeno' && <div className="tool-desc"><strong>Proč řešit:</strong> {item.whyItMatters}</div>}
              <div className="tool-tags" style={{ marginTop: 8 }}>
                {item.apiIntegrations !== 'neuvedeno' && <span className="tag">API: {item.apiIntegrations}</span>}
                {item.pricingLicense !== 'neuvedeno' && <span className="tag">{item.pricingLicense}</span>}
                {item.tags.map(tag => <span key={`t-${tag}`} className="tag">{tag}</span>)}
                {item.topicKeywords.map(kw => <span key={`k-${kw}`} className="tag" style={{ opacity: 0.7 }}>#{kw}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
