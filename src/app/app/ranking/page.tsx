'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase, type UseCase } from '@/lib/supabase'

function Section({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      {title}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

type SortKey = 'rating' | 'created_at' | 'effort' | 'impact'

const CATEGORIES = [
  { value: '', label: 'Všechny', emoji: '✦' },
  { value: 'images', label: 'Obrázky', emoji: '🖼️' },
  { value: 'video', label: 'Video', emoji: '🎬' },
  { value: 'coding', label: 'Kódování', emoji: '💻' },
  { value: 'chatbot', label: 'Chatbot', emoji: '🤖' },
  { value: 'text', label: 'Text', emoji: '✍️' },
  { value: 'audio', label: 'Audio', emoji: '🎵' },
  { value: 'data', label: 'Data', emoji: '📊' },
  { value: 'design', label: 'Design', emoji: '🎨' },
  { value: 'productivity', label: 'Produktivita', emoji: '🔧' },
  { value: 'other', label: 'Ostatní', emoji: '🔮' },
]

const EFFORT_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 }
const IMPACT_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 }

function RatingBar({ value }: { value: number | null }) {
  if (!value) return <span className="ranking-rating-empty">—</span>
  return (
    <div className="ranking-rating-bar" title={`${value}/10`}>
      <div className="ranking-rating-fill" style={{ width: `${value * 10}%` }} />
      <span className="ranking-rating-label">{value}/10</span>
    </div>
  )
}

function BadgeEffort({ value }: { value: string | null }) {
  if (!value) return null
  const map: Record<string, string> = { low: 'tag-green', medium: 'tag-amber', high: 'tag-red' }
  const labels: Record<string, string> = { low: 'Nízká náročnost', medium: 'Střední náročnost', high: 'Vysoká náročnost' }
  return <span className={`tag ${map[value] || ''}`}>{labels[value] || value}</span>
}

function BadgeImpact({ value }: { value: string | null }) {
  if (!value) return null
  const map: Record<string, string> = { low: '', medium: 'tag-blue', high: 'tag-purple' }
  const labels: Record<string, string> = { low: 'Nízký dopad', medium: 'Střední dopad', high: 'Vysoký dopad' }
  return <span className={`tag ${map[value] || ''}`}>{labels[value] || value}</span>
}

function BadgeRecommended({ value }: { value: string | null }) {
  if (!value) return null
  const map: Record<string, string> = { ano: 'tag-green', ne: 'tag-red', možná: 'tag-amber' }
  const labels: Record<string, string> = { ano: '✓ Doporučeno', ne: '✗ Nedoporučeno', možná: '? Možná' }
  return <span className={`tag ${map[value] || ''}`}>{labels[value] || value}</span>
}

function CategoryBadge({ value }: { value: string | null }) {
  if (!value) return null
  const cat = CATEGORIES.find(c => c.value === value)
  if (!cat || !cat.value) return null
  return <span className="ranking-cat-badge">{cat.emoji} {cat.label}</span>
}

function MedalOrNumber({ rank }: { rank: number }) {
  if (rank === 1) return <span className="ranking-medal">🥇</span>
  if (rank === 2) return <span className="ranking-medal">🥈</span>
  if (rank === 3) return <span className="ranking-medal">🥉</span>
  return <span className="ranking-rank-num">{rank}</span>
}

export default function RankingPage() {
  const [usecases, setUsecases] = useState<UseCase[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [activeTag, setActiveTag] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('rating')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<UseCase | null>(null)

  useEffect(() => {
    supabase
      .from('use_cases')
      .select('*')
      .in('status', ['published', 'review'])
      .then(({ data }: any) => {
        setUsecases(data ?? [])
        setLoading(false)
      })
  }, [])

  const allTags = useMemo(() => {
    const counts: Record<string, number> = {}
    usecases.forEach(u => u.tags?.forEach(t => { counts[t] = (counts[t] ?? 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t]) => t)
  }, [usecases])

  const sorted = useMemo(() => {
    let items = [...usecases]

    if (category) items = items.filter(u => (u as any).category === category)
    if (activeTag) items = items.filter(u => u.tags?.includes(activeTag))
    if (q) {
      const ql = q.toLowerCase()
      items = items.filter(u =>
        u.title?.toLowerCase().includes(ql) ||
        u.tool_name?.toLowerCase().includes(ql) ||
        u.description?.toLowerCase().includes(ql)
      )
    }

    if (sortKey === 'rating') {
      items.sort((a, b) => {
        const ra = (a as any).rating ?? 0
        const rb = (b as any).rating ?? 0
        if (rb !== ra) return rb - ra
        return (b.confidence_score ?? 0) - (a.confidence_score ?? 0)
      })
    } else if (sortKey === 'created_at') {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortKey === 'effort') {
      items.sort((a, b) => (EFFORT_ORDER[b.effort ?? ''] ?? 0) - (EFFORT_ORDER[a.effort ?? ''] ?? 0))
    } else if (sortKey === 'impact') {
      items.sort((a, b) => (IMPACT_ORDER[b.impact ?? ''] ?? 0) - (IMPACT_ORDER[a.impact ?? ''] ?? 0))
    }

    return items
  }, [usecases, category, activeTag, sortKey, q])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>🏆 Žebříček</h1>
          <p>Nejlépe hodnocené use casy seřazené podle ratingu.</p>
        </div>
      </div>

      <div className="page-body">
        {/* Kategorie */}
        <div className="ranking-cats">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              className={`ranking-cat-btn${category === cat.value ? ' active' : ''}`}
              onClick={() => { setCategory(cat.value); setActiveTag('') }}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Tagy */}
        {allTags.length > 0 && (
          <div className="ranking-tags-row">
            {activeTag && (
              <button className="ranking-tag-chip active" onClick={() => setActiveTag('')}>
                ✕ {activeTag}
              </button>
            )}
            {allTags.filter(t => t !== activeTag).map(t => (
              <button key={t} className="ranking-tag-chip" onClick={() => setActiveTag(t)}>
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Vyhledávání + řazení */}
        <div className="ranking-toolbar">
          <input
            className="search-box"
            style={{ marginBottom: 0, maxWidth: 300 }}
            placeholder="Hledat v žebříčku…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 160 }}
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
          >
            <option value="rating">⭐ Řadit: Rating</option>
            <option value="created_at">🕐 Řadit: Nejnovější</option>
            <option value="effort">🔧 Řadit: Effort</option>
            <option value="impact">💥 Řadit: Impact</option>
          </select>
          <span className="ranking-count">{sorted.length} use casů</span>
        </div>

        {/* List */}
        {loading ? (
          <div className="empty"><span className="empty-icon">⏳</span>Načítám…</div>
        ) : sorted.length === 0 ? (
          <div className="empty"><span className="empty-icon">🏆</span>Žádné výsledky pro tato kritéria.</div>
        ) : (
          <div className="ranking-list">
            {sorted.map((u, i) => {
              const uc = u as any
              return (
                <div key={u.id} className={`ranking-item${i < 3 ? ' ranking-item-top' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setSelected(u)}>
                  <div className="ranking-item-rank">
                    <MedalOrNumber rank={i + 1} />
                  </div>
                  <div className="ranking-item-body">
                    <div className="ranking-item-header">
                      <div className="ranking-item-title">
                        {u.tool_name && <span className="ranking-tool-name">{u.tool_name}</span>}
                        <span className="ranking-title">{u.title}</span>
                      </div>
                      <RatingBar value={uc.rating} />
                    </div>
                    {u.description && (
                      <div className="ranking-desc">{u.description}</div>
                    )}
                    <div className="ranking-badges">
                      <CategoryBadge value={uc.category} />
                      <BadgeRecommended value={uc.recommended} />
                      <BadgeEffort value={u.effort} />
                      <BadgeImpact value={u.impact} />
                      {u.tags?.map(t => (
                        <button
                          key={t}
                          className={`tag ranking-tag-link${t === activeTag ? ' active' : ''}`}
                          onClick={e => { e.stopPropagation(); setActiveTag(t === activeTag ? '' : t) }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="ranking-item-footer">
                      {u.author_name && <span className="ranking-author">autor: {u.author_name}</span>}
                      <span className="ranking-date">{new Date(u.created_at).toLocaleDateString('cs-CZ')}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ width: 680 }}>
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{selected.title}</div>
              <div className="modal-subtitle">
                {selected.tool_name && <>{selected.tool_name} · </>}
                {selected.team && <>{selected.team} · </>}
                autor: {selected.author_name}
              </div>
            </div>

            {selected.description && (
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>{selected.description}</div>
            )}

            <Section title="Základní přehled" />
            <Field label="Účel nástroje" value={(selected as any).purpose} />
            <Field label="Podobné nástroje" value={(selected as any).similar_tools} />
            <Field label="Cena" value={(selected as any).pricing} />

            <Section title="Přínos pro byznys" />
            <Field label="Nejlepší pro" value={(selected as any).best_for_roles} />
            <Field label="Úspora času" value={(selected as any).time_saved} />
            <Field label="Aha! moment" value={(selected as any).aha_moment} />

            <Section title="Uživatelská přívětivost" />
            <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
              {(selected as any).onboarding_score && <span className="tag">Onboarding: {(selected as any).onboarding_score}/5</span>}
              {(selected as any).ui_intuitive && <span className="tag">UI: {(selected as any).ui_intuitive}</span>}
            </div>

            <Section title="Výkon AI" />
            <Field label="Kvalita výstupů" value={(selected as any).output_quality} />
            {(selected as any).hallucinates && (
              <div style={{ marginBottom: 12 }}>
                <span className="tag">Halucinace: {(selected as any).hallucinates}</span>
              </div>
            )}

            <Section title="Rizika" />
            <Field label="Slabiny" value={(selected as any).weaknesses} />
            <Field label="Bezpečnostní rizika" value={(selected as any).security_risks} />
            <Field label="Limity nástroje" value={(selected as any).limitations} />

            <Section title="Finální verdikt" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {(selected as any).recommended && <span className={`tag ${(selected as any).recommended === 'ano' ? 'tag-green' : (selected as any).recommended === 'ne' ? 'tag-red' : 'tag-amber'}`}>Doporučení: {(selected as any).recommended}</span>}
              {(selected as any).rating && <span className="tag">⭐ {(selected as any).rating}/10</span>}
              {selected.effort && <span className="tag">Náročnost: {selected.effort}</span>}
              {selected.impact && <span className="tag">Dopad: {selected.impact}</span>}
              {selected.confidence_score > 0 && <span className="tag">Confidence: {selected.confidence_score}%</span>}
            </div>
            {selected.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {selected.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
