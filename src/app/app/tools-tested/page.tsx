'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Tool, type ToolAudit } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

type ToolWithAudit = Tool & { audit: ToolAudit | null }

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

  const [rows, setRows] = useState<ToolWithAudit[]>([])
  const [q, setQ] = useState('')
  const [recommendedFilter, setRecommendedFilter] = useState<'all' | 'recommended' | 'not'>('all')
  const [sort, setSort] = useState<'rating' | 'date'>('rating')
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    // Tooly status='completed' s jejich nejnovějším approved auditem
    const { data: tools, error: e1 } = await supabase
      .from('tools')
      .select('*')
      .eq('status', 'completed')
      .order('claimed_at', { ascending: false })
    if (e1) { setError(e1.message); return }

    const toolIds = (tools ?? []).map((t: Tool) => t.id)
    if (toolIds.length === 0) { setRows([]); return }

    const { data: audits, error: e2 } = await supabase
      .from('tool_audits')
      .select('*')
      .in('tool_id', toolIds)
      .eq('status', 'approved')
      .order('reviewed_at', { ascending: false })
    if (e2) { setError(e2.message); return }

    const auditByTool: Record<string, ToolAudit> = {}
    for (const a of (audits ?? []) as ToolAudit[]) {
      if (!auditByTool[a.tool_id]) auditByTool[a.tool_id] = a
    }
    setRows((tools as Tool[]).map(t => ({ ...t, audit: auditByTool[t.id] ?? null })))
  }

  useEffect(() => { fetchData() }, [])

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

  const opened = useMemo(() => rows.find(r => r.id === openId) ?? null, [rows, openId])

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Otestované nástroje</h1>
          <p>Schválené audity. Fine-grained list nástrojů, které prošly verifikací.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={fetchData}>Obnovit</button>
        </div>
      </div>

      <div className="page-body">
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Otestovaných</div>
            <div className="stat-value">{rows.length}</div>
            <div className="stat-sub">se schváleným auditem</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Průměr. rating</div>
            <div className="stat-value">
              {rows.length > 0
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
          <div className="empty"><span className="empty-icon">✦</span>Žádné otestované nástroje. Až analytik dokončí audit a my ho schválíme, objeví se tady.</div>
        ) : visible.map(r => (
          <div key={r.id} className="tool-card" style={{ cursor: 'pointer' }} onClick={() => setOpenId(r.id)}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div className="tool-name">{r.name}</div>
                {r.audit?.rating != null && <span className="tag tag-green">★ {r.audit.rating}/10</span>}
                {r.audit?.recommended && <span className="tag">{r.audit.recommended}</span>}
                {r.category && <span className="tag tag-violet">{r.category}</span>}
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
      </div>

      {/* Detail modal */}
      {opened && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setOpenId(null)}>
          <div className="modal modal-detail">
            <button className="modal-close" onClick={() => setOpenId(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{opened.name}</div>
              <div className="tool-vendor">
                {opened.vendor}{opened.website_url && <> · <a href={opened.website_url} target="_blank" rel="noopener noreferrer">{opened.website_url} ↗</a></>}
              </div>
              {opened.audit && (
                <div className="tool-vendor" style={{ marginTop: 4 }}>
                  Audit od <strong>{opened.audit.author_name ?? '—'}</strong> · schválen {formatDate(opened.audit.reviewed_at)}
                  {opened.audit.reviewer_name && <> přes <strong>{opened.audit.reviewer_name}</strong></>}
                </div>
              )}
            </div>
            <div className="modal-body">
              {opened.description && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>Popis nástroje</div>
                  <div>{opened.description}</div>
                </div>
              )}
              {opened.audit && AUDIT_DISPLAY.map(f => {
                const value = opened.audit?.[f.key]
                if (value === null || value === undefined || value === '') return null
                return (
                  <div key={f.key as string} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>{f.label}</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{String(value)}</div>
                  </div>
                )
              })}
              {!opened.audit && (
                <div className="empty">Audit chybí — pravděpodobně historický záznam před zavedením audit flow.</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOpenId(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
