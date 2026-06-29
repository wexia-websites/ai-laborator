'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Tool, type ToolAudit } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

type ToolWithAudit = Tool & { audit: ToolAudit | null }

interface UseCase {
  id: string
  title: string
  tool_name: string | null
  description: string | null
  rating: number | null
  recommended: string | null
  category: string | null
  tags: string[] | null
  effort: string | null
  impact: string | null
  created_at: string | null
  author_name: string | null
  team: string | null
}

const AUDIT_DISPLAY: Array<{ key: keyof ToolAudit; label: string }> = [
  { key: 'purpose',          label: 'K čemu se hodí' },
  { key: 'best_for_roles',   label: 'Pro koho' },
  { key: 'output_quality',   label: 'Kvalita výstupu' },
  { key: 'hallucinates',     label: 'Halucinuje' },
  { key: 'weaknesses',       label: 'Slabiny' },
  { key: 'security_risks',   label: 'Bezpečnostní rizika' },
  { key: 'limitations',      label: 'Limity' },
  { key: 'ui_intuitive',     label: 'Intuitivnost UI' },
  { key: 'onboarding_score', label: 'Onboarding (1–10)' },
  { key: 'time_saved',       label: 'Ušetří času' },
  { key: 'aha_moment',       label: 'Aha moment' },
  { key: 'pricing',          label: 'Cena / licence' },
  { key: 'recommended',      label: 'Doporučuje' },
  { key: 'rating',           label: 'Rating (1–10)' },
  { key: 'notes',            label: 'Souhrn / poznámky' },
]

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

export default function ToolsTestedPage() {
  const router = useRouter()
  const { canAccess, loading: roleLoading } = useRole()

  useEffect(() => {
    if (!roleLoading && !canAccess('tools-tested')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const [viewTab, setViewTab] = useState<'tools' | 'usecases'>('tools')

  // --- Tools tab state ---
  const [rows, setRows] = useState<ToolWithAudit[]>([])
  const [q, setQ] = useState('')
  const [recommendedFilter, setRecommendedFilter] = useState<'all' | 'recommended' | 'not'>('all')
  const [sort, setSort] = useState<'rating' | 'date'>('rating')
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // --- Use casy tab state ---
  const [useCases, setUseCases] = useState<UseCase[]>([])
  const [ucQ, setUcQ] = useState('')
  const [openUcId, setOpenUcId] = useState<string | null>(null)
  const [ucError, setUcError] = useState<string | null>(null)

  const fetchData = async () => {
    const { data: tools, error: e1 } = await supabase
      .from('tools')
      .select('*')
      .in('status', ['in_progress', 'completed'])
      .order('claimed_at', { ascending: false })
    if (e1) { setError(e1.message); return }

    const toolIds = (tools ?? []).map((t: Tool) => t.id)
    if (toolIds.length === 0) { setRows([]); return }

    const { data: audits, error: e2 } = await supabase
      .from('tool_audits')
      .select('*')
      .in('tool_id', toolIds)
      .order('reviewed_at', { ascending: false })
    if (e2) { setError(e2.message); return }

    const auditByTool: Record<string, ToolAudit> = {}
    for (const a of (audits ?? []) as ToolAudit[]) {
      if (!auditByTool[a.tool_id]) auditByTool[a.tool_id] = a
    }
    setRows((tools as Tool[]).map(t => ({ ...t, audit: auditByTool[t.id] ?? null })))
  }

  const fetchUseCases = async () => {
    const { data, error: e } = await supabase
      .from('use_cases')
      .select('id, title, tool_name, description, rating, recommended, category, tags, effort, impact, created_at, author_name, team')
      .eq('status', 'published')
      .not('tool_name', 'is', null)
      .order('rating', { ascending: false, nullsFirst: false })
    if (e) { setUcError(e.message); return }
    setUseCases((data ?? []) as UseCase[])
  }

  useEffect(() => { fetchData() }, [])
  useEffect(() => { if (viewTab === 'usecases' && useCases.length === 0) fetchUseCases() }, [viewTab])

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = rows
    if (needle) {
      list = list.filter(r =>
        r.name?.toLowerCase().includes(needle)
        || r.vendor?.toLowerCase().includes(needle)
        || r.category?.toLowerCase().includes(needle)
        || r.description?.toLowerCase().includes(needle)
        || r.tags?.some(t => t.toLowerCase().includes(needle))
        || r.audit?.notes?.toLowerCase().includes(needle)
        || r.audit?.purpose?.toLowerCase().includes(needle),
      )
    }
    if (recommendedFilter !== 'all') {
      list = list.filter(r => {
        const rec = (r.audit?.recommended ?? '').toLowerCase()
        const isRec = /\bano\b|\byes\b|recommend/.test(rec)
        return recommendedFilter === 'recommended' ? isRec : !isRec
      })
    }
    if (sort === 'rating') {
      list = [...list].sort((a, b) => (b.audit?.rating ?? -1) - (a.audit?.rating ?? -1))
    } else {
      list = [...list].sort((a, b) => {
        const ta = a.audit?.reviewed_at ? new Date(a.audit.reviewed_at).getTime() : 0
        const tb = b.audit?.reviewed_at ? new Date(b.audit.reviewed_at).getTime() : 0
        return tb - ta
      })
    }
    return list
  }, [rows, q, recommendedFilter, sort])

  const visibleUc = useMemo(() => {
    const needle = ucQ.trim().toLowerCase()
    if (!needle) return useCases
    return useCases.filter(uc =>
      uc.tool_name?.toLowerCase().includes(needle)
      || uc.title?.toLowerCase().includes(needle)
      || uc.description?.toLowerCase().includes(needle)
      || uc.category?.toLowerCase().includes(needle)
      || uc.tags?.some(t => t.toLowerCase().includes(needle))
      || uc.team?.toLowerCase().includes(needle),
    )
  }, [useCases, ucQ])

  const opened = useMemo(() => rows.find(r => r.id === openId) ?? null, [rows, openId])
  const openedUc = useMemo(() => useCases.find(uc => uc.id === openUcId) ?? null, [useCases, openUcId])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Otestované nástroje</h1>
          <p>Přehled nástrojů a use casů z auditů a chatových interview.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => { fetchData(); fetchUseCases() }}>Obnovit</button>
        </div>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div className="tabs-row" style={{ marginBottom: 20 }}>
          <button
            className={`tab-btn${viewTab === 'tools' ? ' active' : ''}`}
            onClick={() => setViewTab('tools')}
          >
            Audity nástrojů <span className="tab-count">{rows.length}</span>
          </button>
          <button
            className={`tab-btn${viewTab === 'usecases' ? ' active' : ''}`}
            onClick={() => setViewTab('usecases')}
          >
            Use casy <span className="tab-count">{useCases.length}</span>
          </button>
        </div>

        {/* ===== TOOLS TAB ===== */}
        {viewTab === 'tools' && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Otestovaných</div>
                <div className="stat-value">{rows.length}</div>
                <div className="stat-sub">se záznamem</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Průměr. rating</div>
                <div className="stat-value">
                  {rows.filter(r => r.audit?.rating != null).length > 0
                    ? (rows.reduce((s, r) => s + (r.audit?.rating ?? 0), 0) / rows.filter(r => r.audit?.rating != null).length).toFixed(1)
                    : '—'}
                </div>
                <div className="stat-sub">z 10</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Doporučené</div>
                <div className="stat-value">
                  {rows.filter(r => /\bano\b|\byes\b|recommend/i.test(r.audit?.recommended ?? '')).length}
                </div>
                <div className="stat-sub">explicitně „ano"</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <input className="search-box" placeholder="Hledat (název, vendor, téma, poznámky)…" value={q} onChange={e => setQ(e.target.value)} style={{ flex: '1 1 280px', marginBottom: 0 }} />
              <select className="form-select" value={recommendedFilter} onChange={e => setRecommendedFilter(e.target.value as 'all' | 'recommended' | 'not')} style={{ width: 180 }}>
                <option value="all">Všechny doporučení</option>
                <option value="recommended">Jen doporučené</option>
                <option value="not">Nedoporučené</option>
              </select>
              <select className="form-select" value={sort} onChange={e => setSort(e.target.value as 'rating' | 'date')} style={{ width: 180 }}>
                <option value="rating">Seřadit dle ratingu</option>
                <option value="date">Seřadit dle data</option>
              </select>
            </div>

            {error && (
              <div className="empty" style={{ marginBottom: 14, borderColor: '#7f1d1d' }}>
                <span className="empty-icon">⚠️</span>{error}
              </div>
            )}

            {visible.length === 0 ? (
              <div className="empty"><span className="empty-icon">✦</span>Žádné otestované nástroje.</div>
            ) : visible.map(r => (
              <div key={r.id} className="tool-card" style={{ cursor: 'pointer' }} onClick={() => setOpenId(r.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="tool-name">{r.name}</div>
                    {r.audit?.rating != null && <span className="tag tag-green">★ {r.audit.rating}/10</span>}
                    {r.audit?.recommended && <span className="tag">{r.audit.recommended}</span>}
                    {r.category && <span className="tag tag-violet">{r.category}</span>}
                    {r.status === 'in_progress' && <span className="tag" style={{ background: 'var(--warning)', color: '#fff' }}>probíhá</span>}
                  </div>
                  <div className="tool-vendor">
                    {r.vendor} · audit od <strong>{r.audit?.author_name ?? '—'}</strong> · schváleno {formatDate(r.audit?.reviewed_at)}
                  </div>
                  {r.audit?.notes && <div className="tool-desc" style={{ marginTop: 6 }}>{r.audit.notes}</div>}
                  {!r.audit?.notes && r.audit?.purpose && <div className="tool-desc" style={{ marginTop: 6 }}>{r.audit.purpose}</div>}
                  <div className="tool-tags" style={{ marginTop: 8 }}>
                    {r.tags?.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>
                <div className="tool-actions">
                  <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setOpenId(r.id) }}>Detail →</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ===== USE CASY TAB ===== */}
        {viewTab === 'usecases' && (
          <>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Publikovaných</div>
                <div className="stat-value">{useCases.length}</div>
                <div className="stat-sub">use casů</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Průměr. rating</div>
                <div className="stat-value">
                  {useCases.filter(uc => uc.rating != null).length > 0
                    ? (useCases.reduce((s, uc) => s + (uc.rating ?? 0), 0) / useCases.filter(uc => uc.rating != null).length).toFixed(1)
                    : '—'}
                </div>
                <div className="stat-sub">z 10</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Doporučené</div>
                <div className="stat-value">
                  {useCases.filter(uc => /\bano\b|\byes\b/i.test(uc.recommended ?? '')).length}
                </div>
                <div className="stat-sub">explicitně „ano"</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <input className="search-box" placeholder="Hledat (nástroj, téma, tým, tagy)…" value={ucQ} onChange={e => setUcQ(e.target.value)} style={{ width: '100%', marginBottom: 0 }} />
            </div>

            {ucError && (
              <div className="empty" style={{ marginBottom: 14, borderColor: '#7f1d1d' }}>
                <span className="empty-icon">⚠️</span>{ucError}
              </div>
            )}

            {visibleUc.length === 0 ? (
              <div className="empty"><span className="empty-icon">✦</span>Žádné use casy. Vytvořte je přes chat.</div>
            ) : visibleUc.map(uc => (
              <div key={uc.id} className="tool-card" style={{ cursor: 'pointer' }} onClick={() => setOpenUcId(uc.id)}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="tool-name">{uc.tool_name}</div>
                    {uc.rating != null && <span className="tag tag-green">★ {uc.rating}/10</span>}
                    {uc.recommended && <span className="tag">{uc.recommended}</span>}
                    {uc.category && <span className="tag tag-violet">{uc.category}</span>}
                    {uc.effort && <span className="tag">effort: {uc.effort}</span>}
                  </div>
                  <div className="tool-vendor">
                    {uc.title} · autor <strong>{uc.author_name ?? '—'}</strong>{uc.team ? ` · ${uc.team}` : ''} · {formatDate(uc.created_at)}
                  </div>
                  {uc.description && (
                    <div className="tool-desc" style={{ marginTop: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {uc.description}
                    </div>
                  )}
                  <div className="tool-tags" style={{ marginTop: 8 }}>
                    {uc.tags?.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>
                <div className="tool-actions">
                  <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); setOpenUcId(uc.id) }}>Detail →</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ===== TOOLS DETAIL MODAL ===== */}
      {opened && (() => {
        const a = opened.audit
        const rating = a?.rating ?? null
        const ratingClass = !rating ? '' : rating >= 8 ? 'uc-rating-high' : rating >= 6 ? 'uc-rating-mid' : 'uc-rating-low'
        const recBadge = a?.recommended === 'ano' ? 'uc-badge-yes' : a?.recommended === 'ne' ? 'uc-badge-no' : a?.recommended === 'možná' ? 'uc-badge-maybe' : ''
        const recLabel = a?.recommended === 'ano' ? '✓ Doporučeno' : a?.recommended === 'ne' ? '✗ Nedoporučeno' : a?.recommended === 'možná' ? '? Možná' : ''
        return (
          <div
            className="modal-bg open"
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={e => e.target === e.currentTarget && setOpenId(null)}
          >
            <div className="modal modal-detail" style={{ width: '90vw', maxWidth: 860, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <button className="modal-close" onClick={() => setOpenId(null)}>×</button>

              {/* Hlavička */}
              <div className="uc-modal-header">
                <div className="uc-modal-badges">
                  {opened.category && <span className="uc-badge uc-badge-cat">{opened.category}</span>}
                  {opened.status === 'in_progress' && (
                    <span className="uc-badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.3)' }}>Probíhá</span>
                  )}
                  {recBadge && <span className={`uc-badge ${recBadge}`}>{recLabel}</span>}
                  {rating && <span className={`uc-modal-rating ${ratingClass}`}>⭐ {rating}/10</span>}
                </div>
                <div className="uc-modal-title">{opened.name}</div>
                <div className="uc-modal-subtitle">
                  {opened.vendor && <span>🏢 {opened.vendor}</span>}
                  {a?.author_name && <span>👤 {a.author_name}</span>}
                  {a?.reviewed_at && <span>📅 {formatDate(a.reviewed_at)}</span>}
                </div>
                {opened.website_url && (
                  <div style={{ marginTop: 8 }}>
                    <a href={opened.website_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>
                      🔗 {opened.website_url} ↗
                    </a>
                  </div>
                )}
                {opened.description && <div className="uc-modal-desc">{opened.description}</div>}
              </div>

              {/* Scrollovatelný obsah */}
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 24px' }}>
                {/* Metriky */}
                <div className="uc-metrics">
                  <div className="uc-metric">
                    <div className="uc-metric-label">Hodnocení</div>
                    <div className="uc-metric-value">{rating ? `${rating}/10` : '—'}</div>
                  </div>
                  <div className="uc-metric">
                    <div className="uc-metric-label">Onboarding</div>
                    <div className="uc-metric-value">{a?.onboarding_score ? `${a.onboarding_score}/10` : '—'}</div>
                  </div>
                  <div className="uc-metric">
                    <div className="uc-metric-label">Legit skóre</div>
                    <div className="uc-metric-value">{opened.legit_score ? `${opened.legit_score}/10` : '—'}</div>
                  </div>
                </div>

                {/* Účel + Pro koho + Cena */}
                {a?.purpose && (
                  <>
                    <div className="uc-section">🎯 Účel nástroje</div>
                    <div className="uc-field">{a.purpose}</div>
                  </>
                )}
                {a?.best_for_roles && (
                  <>
                    <div className="uc-section">👥 Nejlepší pro</div>
                    <div className="uc-field">{a.best_for_roles}</div>
                  </>
                )}
                {a?.pricing && (
                  <>
                    <div className="uc-section">💰 Cena</div>
                    <div className="uc-field">{a.pricing}</div>
                  </>
                )}

                {/* Barevné kartičky: Úspora + Aha moment */}
                {(a?.time_saved || a?.aha_moment) && (
                  <div className="uc-highlights">
                    {a.time_saved && (
                      <div className="uc-highlight uc-highlight-green">
                        <div className="uc-highlight-icon">⏱</div>
                        <div className="uc-highlight-label">Úspora času</div>
                        <div className="uc-highlight-text">{a.time_saved}</div>
                      </div>
                    )}
                    {a.aha_moment && (
                      <div className="uc-highlight uc-highlight-blue">
                        <div className="uc-highlight-icon">✨</div>
                        <div className="uc-highlight-label">Aha! moment</div>
                        <div className="uc-highlight-text">{a.aha_moment}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Uživatelská přívětivost */}
                {(a?.onboarding_score || a?.ui_intuitive) && (
                  <>
                    <div className="uc-section">⭐ Uživatelská přívětivost</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
                      {a.onboarding_score && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Onboarding (1–10)</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{a.onboarding_score}/10</div>
                        </div>
                      )}
                      {a.ui_intuitive && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>UI intuitivní</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{a.ui_intuitive}</div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Výkon AI */}
                {(a?.output_quality || a?.hallucinates) && (
                  <>
                    <div className="uc-section">🤖 Výkon AI</div>
                    {a.output_quality && <div className="uc-field">{a.output_quality}</div>}
                    {a.hallucinates && (
                      <div style={{ marginBottom: 14 }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)', marginRight: 8 }}>Halucinace:</span>
                        <span className={`uc-halluc-badge ${a.hallucinates === 'ne' ? 'uc-halluc-no' : a.hallucinates === 'ano' ? 'uc-halluc-yes' : 'uc-halluc-sometimes'}`}>
                          {a.hallucinates === 'ne' ? '✓ Nehalucinuje' : a.hallucinates === 'ano' ? '✗ Halucinuje' : '⚠ Občas'}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Slabiny + Bezpečnostní rizika */}
                {(a?.weaknesses || a?.security_risks) && (
                  <div className="uc-highlights">
                    {a.weaknesses && (
                      <div className="uc-highlight uc-highlight-yellow">
                        <div className="uc-highlight-icon">⚠</div>
                        <div className="uc-highlight-label">Slabiny</div>
                        <div className="uc-highlight-text">{a.weaknesses}</div>
                      </div>
                    )}
                    {a.security_risks && (
                      <div className="uc-highlight uc-highlight-red">
                        <div className="uc-highlight-icon">🔒</div>
                        <div className="uc-highlight-label">Bezpečnostní rizika</div>
                        <div className="uc-highlight-text">{a.security_risks}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Limitace */}
                {a?.limitations && (
                  <>
                    <div className="uc-section">🚧 Limitace</div>
                    <div className="uc-field">{a.limitations}</div>
                  </>
                )}

                {/* Souhrn / poznámky */}
                {a?.notes && (
                  <>
                    <div className="uc-section">📝 Souhrn</div>
                    <div className="uc-field">{a.notes}</div>
                  </>
                )}

                {/* Poznámka reviewera */}
                {a?.reviewer_note && (
                  <>
                    <div className="uc-section">✅ Poznámka reviewera</div>
                    <div className="uc-field">{a.reviewer_note}</div>
                  </>
                )}

                {/* Tagy */}
                {opened.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                    {opened.tags.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                )}

                {!a && (
                  <div className="empty">Audit chybí — pravděpodobně historický záznam před zavedením audit flow.</div>
                )}
              </div>

              {/* Patička */}
              <div className="modal-footer" style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '12px 24px' }}>
                <div style={{ flex: 1 }} />
                <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(null)}>Zavřít</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ===== USE CASE DETAIL MODAL ===== */}
      {openedUc && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setOpenUcId(null)}>
          <div className="modal modal-detail">
            <button className="modal-close" onClick={() => setOpenUcId(null)}>×</button>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <div className="modal-title">{openedUc.tool_name}</div>
                {openedUc.rating != null && <span className="tag tag-green" style={{ fontSize: 15 }}>★ {openedUc.rating}/10</span>}
                {openedUc.recommended && <span className="tag">{openedUc.recommended}</span>}
                {openedUc.category && <span className="tag tag-violet">{openedUc.category}</span>}
              </div>
              <div className="tool-vendor">{openedUc.title}</div>
              <div className="tool-vendor" style={{ marginTop: 4 }}>
                Autor <strong>{openedUc.author_name ?? '—'}</strong>{openedUc.team ? ` · ${openedUc.team}` : ''} · {formatDate(openedUc.created_at)}
              </div>
            </div>
            <div className="modal-body">
              {openedUc.description && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Popis</div>
                  <div>{openedUc.description}</div>
                </div>
              )}
              {(openedUc.effort || openedUc.impact) && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  {openedUc.effort && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Náročnost</div>
                      <span className="tag">{openedUc.effort}</span>
                    </div>
                  )}
                  {openedUc.impact && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Dopad</div>
                      <span className="tag">{openedUc.impact}</span>
                    </div>
                  )}
                </div>
              )}
              {openedUc.tags && openedUc.tags.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>Tagy</div>
                  <div className="tool-tags">{openedUc.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOpenUcId(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
